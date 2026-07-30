"use strict";

/**
 * Deterministic clinch simulation harness.
 *
 * Distinguishes raw input intent vs buffered requests vs in-progress transitions
 * vs authoritative active state. Advances room.simTime explicitly — never sleeps
 * on wall-clock time.
 *
 * Hitstop note: production freezes simTime while room.hitstopUntil > gameNow().
 * After each tick the harness clears hitstop so subsequent advances stay
 * deterministic. Capture emitted hitstop events before the clear if needed.
 */

const {
  TICK_RATE,
  CLINCH_ATTACHED_DISTANCE,
  CLINCH_LIGHT_DRIVE_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
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
const { updateGrabActions } = require("../../../grabActionSystem");
const { createMockIo } = require("./mockIo");

const DEFAULT_TICK_MS = 1000 / TICK_RATE; // 15.625

let harnessIdCounter = 0;

function towardKey(player, opponent) {
  return player.x < opponent.x ? "d" : "a";
}

function awayKey(player, opponent) {
  return player.x < opponent.x ? "a" : "d";
}

function blankKeys(overrides = {}) {
  return { ...createInitialKeys(), ...overrides };
}

/**
 * Build a mutual-grip clinch with P1 grabber (left) and P2 grabbed (right).
 * Pass { swapRoles: true } to reverse grabber/grabbed while keeping positions.
 */
function createClinchScenario(options = {}) {
  harnessIdCounter += 1;
  const id = harnessIdCounter;
  const startSim = options.simTime != null ? options.simTime : 100_000;
  const midX = options.midX != null
    ? options.midX
    : (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
  const attach = options.attachDistance != null
    ? options.attachDistance
    : CLINCH_ATTACHED_DISTANCE;

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

  const grabber = options.swapRoles ? p2 : p1;
  const grabbed = options.swapRoles ? p1 : p2;

  for (const p of [p1, p2]) {
    p.inClinch = true;
    p.hasGrip = true;
    p.gripAcquiredTime = startSim - 500; // past reaction lock
    p.clinchAttachDistance = attach;
    p.keys = blankKeys();
  }

  grabber.isGrabbing = true;
  grabber.grabbedOpponent = grabbed.id;
  grabber.grabStartTime = startSim - 1000;
  grabber.isBeingGrabbed = false;

  grabbed.isBeingGrabbed = true;
  grabbed.isGrabbing = false;
  grabbed.grabbedOpponent = null;

  const io = createMockIo();
  const room = {
    id: `clinch-room-${id}`,
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
    grabbed,
    tickMs: options.tickMs != null ? options.tickMs : DEFAULT_TICK_MS,
    startSim,

    /** Raw key intent helpers (do NOT set authoritative action state). */
    setKeys(player, keyOverrides) {
      player.keys = blankKeys(keyOverrides);
      return scenario;
    },

    holdToward(player, opponent = scenario.other(player)) {
      const k = towardKey(player, opponent);
      return scenario.setKeys(player, { [k]: true });
    },

    holdAway(player, opponent = scenario.other(player)) {
      const k = awayKey(player, opponent);
      return scenario.setKeys(player, { [k]: true });
    },

    holdNeutral(player) {
      return scenario.setKeys(player, {});
    },

    holdPlantS(player) {
      return scenario.setKeys(player, { s: true });
    },

    other(player) {
      return player === p1 ? p2 : p1;
    },

    setStamina(player, value) {
      player.stamina = value;
      return scenario;
    },

    setBalance(player, value) {
      player.balance = value;
      return scenario;
    },

    setDeepGrip(holder) {
      holder.hasDeepGrip = true;
      scenario.other(holder).hasDeepGrip = false;
      return scenario;
    },

    clearDeepGrip(...players) {
      for (const p of players.length ? players : [p1, p2]) {
        p.hasDeepGrip = false;
        p.deepGripPushStart = 0;
      }
      return scenario;
    },

    setOpen(player, untilSim) {
      player.isClinchOpen = true;
      player.clinchOpenUntil = untilSim;
      player.clinchThrowFailStagger = true;
      return scenario;
    },

    clearOpen(player) {
      player.isClinchOpen = false;
      player.clinchOpenUntil = 0;
      player.clinchThrowFailStagger = false;
      player.clinchOpenHideStars = false;
      return scenario;
    },

    setGassed(player, untilSim = room.simTime + 5000) {
      player.isGassed = true;
      player.gassedUntil = untilSim;
      return scenario;
    },

    clearGassed(player) {
      player.isGassed = false;
      player.gassedUntil = 0;
      return scenario;
    },

    setInputLock(player, untilSim) {
      player.inputLockUntil = untilSim;
      return scenario;
    },

    setActionLock(player, untilSim) {
      player.actionLockUntil = untilSim;
      return scenario;
    },

    /**
     * Put player into Light Drive (toward held, not yet committed).
     * Sets raw keys + drive hold start so the next tick keeps light push.
     */
    setLightDrive(player, opponent = scenario.other(player)) {
      scenario.holdToward(player, opponent);
      player.clinchDriveHoldStart = room.simTime;
      player.isClinchCommittedDrive = false;
      return scenario;
    },

    /**
     * Put player into Committed Drive (toward held long enough).
     */
    setCommittedDrive(player, opponent = scenario.other(player)) {
      scenario.holdToward(player, opponent);
      player.clinchDriveHoldStart = room.simTime - CLINCH_LIGHT_DRIVE_MS - 50;
      player.isClinchCommittedDrive = true;
      return scenario;
    },

    /**
     * Authoritative Plant already active (no cancel pending).
     * Sets raw Plant intent + activation stamp.
     */
    setActivePlant(player, activationSim = room.simTime, opponent = scenario.other(player)) {
      scenario.holdAway(player, opponent);
      player.clinchDrivePlantCancelUntil = 0;
      player.clinchBraceSimTime = activationSim;
      player.clinchBraceLatchUntil = activationSim + 150;
      player.isClinchPlanting = true;
      player.clinchAction = "plant";
      return scenario;
    },

    /**
     * Mid Drive→Plant cancel: raw Plant intent held, Plant not yet authoritative.
     */
    setDrivePlantCancel(player, activateAt, opponent = scenario.other(player)) {
      scenario.holdAway(player, opponent);
      player.clinchDrivePlantCancelUntil = activateAt;
      player.clinchBraceSimTime = activateAt;
      player.isClinchCommittedDrive = false;
      player.clinchDriveHoldStart = 0;
      return scenario;
    },

    /** Buffered technique request (not yet committed). */
    setThrowRequest(player, type, requestTime = room.simTime) {
      player.clinchThrowRequest = type; // "throw" | "pull"
      player.clinchThrowRequestTime = requestTime;
      return scenario;
    },

    setJoltRequest(player, requestTime = room.simTime) {
      player.clinchJoltRequest = true;
      player.clinchJoltRequestTime = requestTime;
      return scenario;
    },

    setBreakRequest(player, requestTime = room.simTime) {
      player.clinchBreakRequest = true;
      player.clinchBreakRequestTime = requestTime;
      return scenario;
    },

    /** Authoritative active technique startup (already committed). */
    setActiveTechnique(actor, type, startTime = room.simTime) {
      actor.clinchThrowRequest = null;
      actor.clinchThrowRequestTime = 0;
      actor.clinchThrowActive = true;
      actor.clinchThrowType = type;
      actor.clinchThrowStartTime = startTime;
      actor.isClinchThrowing = true;
      actor.isAttemptingGrabThrow = type === "throw";
      actor.isAttemptingPull = type === "pull";
      actor.clinchThrowUsedDeepGrip = !!actor.hasDeepGrip;
      if (actor.hasDeepGrip) actor.hasDeepGrip = false;
      actor.clinchThrowKillBalance =
        typeof scenario.other(actor).balance === "number"
          ? scenario.other(actor).balance
          : 100;
      const target = scenario.other(actor);
      target.isResistingThrow = type === "throw";
      target.isResistingPull = type === "pull";
      return scenario;
    },

    setJoltStartup(jolter, startTime = room.simTime) {
      jolter.isClinchJolting = true;
      jolter.clinchJoltStartTime = startTime;
      jolter.clinchJoltRequest = false;
      return scenario;
    },

    setPosition(player, x) {
      player.x = x;
      return scenario;
    },

    placeNearEdge(victim, side = "right") {
      const edge =
        side === "left"
          ? MAP_LEFT_BOUNDARY
          : MAP_RIGHT_BOUNDARY;
      const other = scenario.other(victim);
      if (side === "right") {
        victim.x = edge;
        other.x = edge - attach;
        // Ensure grabber is left of victim for right-edge push
        if (grabber === victim) {
          // victim is grabber — unusual; still place consistently
        }
      } else {
        victim.x = edge;
        other.x = edge + attach;
      }
      return scenario;
    },

    /** Place grabber left, victim at right boundary (grabber pushes right). */
    placeVictimAtRightEdge() {
      grabbed.x = MAP_RIGHT_BOUNDARY;
      grabber.x = MAP_RIGHT_BOUNDARY - attach;
      grabber.facing = 1;
      grabbed.facing = -1;
      return scenario;
    },

    placeVictimAtLeftEdge() {
      grabbed.x = MAP_LEFT_BOUNDARY;
      grabber.x = MAP_LEFT_BOUNDARY + attach;
      grabber.facing = -1;
      grabbed.facing = 1;
      return scenario;
    },

    now() {
      return room.simTime;
    },

    /**
     * Advance sim clock by exact ms, fire sim-scheduled timeouts, clear hitstop.
     * Does not run gameplay.
     */
    advanceTime(ms) {
      if (ms > 0) advanceRoomSimTime(room, ms);
      timeoutManager.processRoom(room);
      room.hitstopUntil = 0;
      return scenario;
    },

    /**
     * Run one authoritative clinch tick at the current simTime, then optionally
     * advance by tickMs (default: yes).
     */
    tick({ advance = true, deltaMs } = {}) {
      const delta = deltaMs != null ? deltaMs : scenario.tickMs;
      io.clear();
      updateGrabActions(grabber, room, io, delta, rooms);
      timeoutManager.processRoom(room);
      // Deterministic sim: clear wall-clock hitstop so the next advanceTime works.
      room.hitstopUntil = 0;
      if (advance) {
        advanceRoomSimTime(room, delta);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
      }
      return scenario;
    },

    /**
     * Advance by ms in tick-sized steps, running gameplay each step.
     * Pattern per step: advance clock by d, then run update at the new time.
     * Ends with a resolve tick at the final time so boundaries (buffer expiry,
     * impact, clash end) are observed even when ms lands exactly on them.
     */
    advance(ms, { tickMs } = {}) {
      const step = tickMs != null ? tickMs : scenario.tickMs;
      let remaining = ms;
      while (remaining > 0.0001) {
        const d = Math.min(step, remaining);
        advanceRoomSimTime(room, d);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
        updateGrabActions(grabber, room, io, d, rooms);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
        remaining -= d;
      }
      return scenario;
    },

    /**
     * Commit helper: set a technique request already past the simul window
     * and resolve it on the next tick.
     */
    commitTechniqueNow(player, type) {
      player.clinchThrowRequest = type;
      player.clinchThrowRequestTime =
        room.simTime - (CLINCH_THROW_CLASH_WINDOW_MS + 1);
      scenario.stepOnce();
      return scenario;
    },

    /**
     * Run gameplay once at current time.
     * @param {number|{ deltaMs?: number, advance?: boolean }} [opts]
     */
    stepOnce(opts) {
      let delta = scenario.tickMs;
      let advance = false;
      if (typeof opts === "number") {
        delta = opts;
      } else if (opts && typeof opts === "object") {
        if (opts.deltaMs != null) delta = opts.deltaMs;
        if (opts.advance) advance = true;
      }
      updateGrabActions(grabber, room, io, delta, rooms);
      timeoutManager.processRoom(room);
      room.hitstopUntil = 0;
      if (advance) {
        advanceRoomSimTime(room, delta);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
      }
      return scenario;
    },

    snapshot(player) {
      return {
        id: player.id,
        x: player.x,
        stamina: player.stamina,
        balance: player.balance,
        keys: { ...player.keys },
        clinchAction: player.clinchAction,
        isClinchPushing: !!player.isClinchPushing,
        isClinchPlanting: !!player.isClinchPlanting,
        isClinchCommittedDrive: !!player.isClinchCommittedDrive,
        clinchDrivePlantCancelUntil: player.clinchDrivePlantCancelUntil || 0,
        clinchBraceSimTime: player.clinchBraceSimTime || 0,
        clinchBraceLatchUntil: player.clinchBraceLatchUntil || 0,
        clinchThrowRequest: player.clinchThrowRequest,
        clinchThrowRequestTime: player.clinchThrowRequestTime || 0,
        clinchThrowActive: !!player.clinchThrowActive,
        clinchThrowType: player.clinchThrowType,
        clinchThrowStartTime: player.clinchThrowStartTime || 0,
        clinchThrowUsedDeepGrip: !!player.clinchThrowUsedDeepGrip,
        clinchJoltRequest: !!player.clinchJoltRequest,
        isClinchJolting: !!player.isClinchJolting,
        clinchJoltStartTime: player.clinchJoltStartTime || 0,
        clinchJoltRecovery: !!player.clinchJoltRecovery,
        isBeingClinchJolted: !!player.isBeingClinchJolted,
        clinchBreakRequest: !!player.clinchBreakRequest,
        hasDeepGrip: !!player.hasDeepGrip,
        isClinchOpen: !!player.isClinchOpen,
        clinchThrowFailStagger: !!player.clinchThrowFailStagger,
        isGassed: !!player.isGassed,
        inputLockUntil: player.inputLockUntil || 0,
        actionLockUntil: player.actionLockUntil || 0,
        inClinch: !!player.inClinch,
        hasGrip: !!player.hasGrip,
        isGrabbing: !!player.isGrabbing,
        isBeingThrown: !!player.isBeingThrown,
        isThrowing: !!player.isThrowing,
        isBeingPullReversaled: !!player.isBeingPullReversaled,
        isGrabBreaking: !!player.isGrabBreaking,
        isGrabBreakSeparating: !!player.isGrabBreakSeparating,
        clinchEdgePinStart: player.clinchEdgePinStart || 0,
        clinchStalemateStart: player.clinchStalemateStart || 0,
        isClinchClashing: !!player.isClinchClashing,
        isClinchPerfectBracing: !!player.isClinchPerfectBracing,
      };
    },

    dispose() {
      timeoutManager.clearPlayer(p1.id);
      timeoutManager.clearPlayer(p2.id);
      setSimRoomResolver(() => null);
    },
  };

  return scenario;
}

/**
 * Run fn(scenario) and the same setup with grabber/grabbed roles swapped.
 * Failures include orientation in the assertion message.
 */
function withRoleSwap(buildOptions, run) {
  const orientations = [
    { swapRoles: false, label: "P1-grabber" },
    { swapRoles: true, label: "P2-grabber" },
  ];
  for (const { swapRoles, label } of orientations) {
    const scenario = createClinchScenario({ ...buildOptions, swapRoles });
    try {
      run(scenario, label);
    } catch (err) {
      err.message = `[${label}] ${err.message}`;
      scenario.dispose();
      throw err;
    }
    scenario.dispose();
  }
}

module.exports = {
  DEFAULT_TICK_MS,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  towardKey,
  awayKey,
  blankKeys,
  createClinchScenario,
  withRoleSwap,
};

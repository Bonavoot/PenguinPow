"use strict";

/**
 * Premium Combat Foundation Phase 1 — deterministic scenario harness.
 *
 * Steps real sim helpers (simTime, pushbox, optional collision) rather than a
 * disconnected reimplementation. Diagnostic volumes are queried AFTER each
 * step and never written back into gameplay state.
 *
 * Hitstop note: production freezes simTime while room.hitstopUntil > gameNow()
 * (wall-clock). For deterministic characterization, use
 *   freezeSimForHitstopCharacterization(room, true)
 * which advances nothing while the flag is set — mirroring the sim freeze
 * without depending on wall-clock expiry.
 */

const {
  TICK_RATE,
  GROUND_LEVEL,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  CHARGED_STARTUP_MS,
  GRAB_STARTUP_MS,
  SIDESTEP_STARTUP_MS,
  SIDESTEP_ACTIVE_MS,
  SIDESTEP_RECOVERY_MS,
  SIDESTEP_TOTAL_MS,
  DODGE_STARTUP_MS,
  DODGE_DURATION,
  LOW_KICK_STARTUP_MS,
  LOW_KICK_ACTIVE_MS,
  LOW_KICK_RECOVERY_MS,
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
  beginPlayerDodge,
} = require("../../../gameUtils");
const {
  arePlayersColliding,
  adjustPlayerPositions,
} = require("../../../gameFunctions");
const { checkCollision } = require("../../../collisionSystem");
const {
  queryCombatVolumes,
  queryCandidateContacts,
} = require("../../../combatVolumeQuery");
const { createMockIo } = require("../../clinch/harness/mockIo");

const DEFAULT_TICK_MS = 1000 / TICK_RATE;
let harnessId = 0;

function blankKeys(overrides = {}) {
  return { ...createInitialKeys(), ...overrides };
}

function createFoundationScenario(options = {}) {
  harnessId += 1;
  const id = harnessId;
  const simTime = options.simTime != null ? options.simTime : 500_000;
  const gap = options.gap != null ? options.gap : 160;
  const mid =
    options.midX != null
      ? options.midX
      : (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
  const sizeA = options.sizeA != null ? options.sizeA : 0.85;
  const sizeB = options.sizeB != null ? options.sizeB : 0.85;

  const left = createInitialPlayerState({
    id: options.leftId || `left-${id}`,
    fighter: "player 1",
    x: options.leftX != null ? options.leftX : mid - gap / 2,
    facing: options.leftFacing != null ? options.leftFacing : -1,
    sizeMultiplier: sizeA,
  });
  const right = createInitialPlayerState({
    id: options.rightId || `right-${id}`,
    fighter: "player 2",
    x: options.rightX != null ? options.rightX : mid + gap / 2,
    facing: options.rightFacing != null ? options.rightFacing : 1,
    sizeMultiplier: sizeB,
  });
  left.keys = blankKeys();
  right.keys = blankKeys();
  left.y = GROUND_LEVEL;
  right.y = GROUND_LEVEL;
  left.canMoveToReady = false;
  right.canMoveToReady = false;

  const players = options.swapPlayerOrder
    ? [right, left]
    : [left, right];

  const io = createMockIo();
  const room = {
    id: `foundation-room-${id}`,
    simTime,
    gameStart: true,
    hakkiyoiCount: 3,
    gameOver: false,
    matchOver: false,
    hitstopUntil: 0,
    players,
    lastScreenShakeTime: 0,
    _foundationHitstopFreeze: false,
  };
  const rooms = [room];
  const byId = new Map([
    [left.id, room],
    [right.id, room],
  ]);
  setSimRoomResolver((playerId) => byId.get(playerId) || null);

  return {
    id,
    room,
    rooms,
    io,
    left,
    right,
    players,
    tickMs: DEFAULT_TICK_MS,
    dispose() {
      setSimRoomResolver(null);
      timeoutManager.clearPlayer(left.id);
      timeoutManager.clearPlayer(right.id);
    },
  };
}

function freezeSimForHitstopCharacterization(room, frozen) {
  room._foundationHitstopFreeze = !!frozen;
}

function advanceSim(scenario, deltaMs) {
  if (scenario.room._foundationHitstopFreeze) {
    // Mirror production: simTime does not advance during hitstop.
    return scenario.room.simTime;
  }
  advanceRoomSimTime(scenario.room, deltaMs);
  timeoutManager.processRoom(scenario.room);
  return scenario.room.simTime;
}

function stepPushbox(scenario, deltaMs) {
  const d = deltaMs != null ? deltaMs : scenario.tickMs;
  const [a, b] = scenario.room.players;
  if (arePlayersColliding(a, b)) {
    adjustPlayerPositions(a, b, d);
  }
}

function stepCollisionBothOrders(scenario) {
  const [a, b] = scenario.room.players;
  if (a.isAttacking) checkCollision(a, b, scenario.rooms, scenario.io);
  if (b.isAttacking) checkCollision(b, a, scenario.rooms, scenario.io);
}

function armSlapPhase(player, phase, now) {
  player.isAttacking = true;
  player.isSlapAttack = true;
  player.attackType = "slap";
  player.slapAnimation = 1;
  player.slapFacingDirection = player.facing;
  player.currentAction = "slap";
  player.movementVelocity = 0;
  if (phase === "startup") {
    player.isInStartupFrames = true;
    player.attackStartTime = now;
    player.slapActiveEndTime = now + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    player.attackEndTime =
      now + SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;
  } else if (phase === "active") {
    player.isInStartupFrames = false;
    player.attackStartTime = now - SLAP_STARTUP_MS - 5;
    player.slapActiveEndTime = player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    player.attackEndTime =
      player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;
  } else {
    // recovery
    player.isInStartupFrames = false;
    player.attackStartTime =
      now - SLAP_STARTUP_MS - SLAP_ACTIVE_MS - 5;
    player.slapActiveEndTime = player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    player.attackEndTime =
      player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;
    player.currentAction = "slap";
  }
  return player;
}

function armPalmPhase(player, phase, now) {
  player.isAttacking = true;
  player.isPalmThrust = true;
  player.isSlapAttack = false;
  player.attackType = "charged";
  player.chargingFacingDirection = player.facing;
  player.currentAction = "palm";
  if (phase === "startup") {
    player.isInStartupFrames = true;
    player.attackStartTime = now;
  } else if (phase === "active") {
    player.isInStartupFrames = false;
    player.attackStartTime = now - PALM_THRUST_STARTUP_MS - 5;
  } else {
    player.isInStartupFrames = false;
    player.attackStartTime =
      now - PALM_THRUST_STARTUP_MS - PALM_THRUST_ACTIVE_MS - 5;
  }
  return player;
}

function armChargedPhase(player, phase, now) {
  player.isAttacking = phase !== "hold";
  player.isChargingAttack = phase === "hold";
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.attackType = "charged";
  player.chargingFacingDirection = player.facing;
  player.chargeAttackPower = 60;
  if (phase === "hold") {
    player.chargeStartTime = now - 200;
    player.attackStartTime = 0;
  } else if (phase === "startup") {
    player.isInStartupFrames = true;
    player.attackStartTime = now;
  } else if (phase === "lunge" || phase === "active") {
    player.isInStartupFrames = false;
    player.attackStartTime = now - CHARGED_STARTUP_MS - 5;
  } else {
    player.isAttacking = false;
    player.isRecovering = true;
    player.recoveryStartTime = now;
    player.recoveryDuration = 280;
    player.currentAction = "charged";
  }
  return player;
}

function armLowKickPhase(player, phase, now) {
  player.isAttacking = true;
  player.isLowKick = true;
  player.isSlapAttack = false;
  player.attackType = "lowKick";
  if (phase === "startup") {
    player.isInStartupFrames = true;
    player.attackStartTime = now;
  } else if (phase === "active") {
    player.isInStartupFrames = false;
    player.attackStartTime = now - LOW_KICK_STARTUP_MS - 5;
  } else {
    player.isInStartupFrames = false;
    player.attackStartTime =
      now - LOW_KICK_STARTUP_MS - LOW_KICK_ACTIVE_MS - 5;
  }
  return player;
}

function armGrabStartup(player, now) {
  player.isGrabStartup = true;
  player.isGrabbingMovement = false;
  player.grabStartupStartTime = now;
  player.currentAction = "grab";
  return player;
}

function armGrabWhiff(player, now) {
  player.isGrabStartup = false;
  player.isWhiffingGrab = true;
  player.isGrabWhiffRecovery = true;
  player.currentAction = "grab";
  player.isRecovering = true;
  player.recoveryStartTime = now;
  player.recoveryDuration = 450;
  return player;
}

function armDodge(player, now, direction) {
  beginPlayerDodge(player, {
    nowSim: now,
    direction: direction != null ? direction : 1,
    clearCharge: true,
  });
  return player;
}

function armSidestepPhase(player, phase, now, direction) {
  const dir = direction != null ? direction : 1;
  player.isSidestepping = true;
  player.sidestepDirection = dir;
  player.sidestepStartX = player.x;
  player.sidestepStartTime = now;
  player.currentAction = "sidestep";
  if (phase === "startup") {
    player.isSidestepStartup = true;
    player.isSidestepRecovery = false;
    player.sidestepStartupEndTime = now + SIDESTEP_STARTUP_MS;
    player.sidestepActiveEndTime = now + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
    player.sidestepEndTime = now + SIDESTEP_TOTAL_MS;
  } else if (phase === "active") {
    player.isSidestepStartup = false;
    player.isSidestepRecovery = false;
    player.sidestepStartupEndTime = now - 5;
    player.sidestepActiveEndTime = now + SIDESTEP_ACTIVE_MS;
    player.sidestepEndTime = player.sidestepActiveEndTime + SIDESTEP_RECOVERY_MS;
    player.sidestepTargetX = player.x + dir * 160;
  } else {
    player.isSidestepStartup = false;
    player.isSidestepRecovery = true;
    player.sidestepStartupEndTime = now - SIDESTEP_ACTIVE_MS - 5;
    player.sidestepActiveEndTime = now - 5;
    player.sidestepEndTime = now + SIDESTEP_RECOVERY_MS;
    player.sidestepTargetX = player.x;
    player.sidestepRecoveryTargetX = player.x;
  }
  return player;
}

function clearActionState(player) {
  player.isAttacking = false;
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.isLowKick = false;
  player.isChargingAttack = false;
  player.isInStartupFrames = false;
  player.isInEndlag = false;
  player.isRecovering = false;
  player.isGrabStartup = false;
  player.isWhiffingGrab = false;
  player.isGrabWhiffRecovery = false;
  player.isDodging = false;
  player.isDodgeStartup = false;
  player.isDodgeRecovery = false;
  player.isSidestepping = false;
  player.isSidestepStartup = false;
  player.isSidestepRecovery = false;
  player.sidestepDirection = 0;
  player.isHit = false;
  player.currentAction = null;
  player._phase1SlapRecoveryLimb = false;
  player.actionLockUntil = 0;
  player.y = GROUND_LEVEL;
}

function resetRematch(scenario) {
  clearActionState(scenario.left);
  clearActionState(scenario.right);
  scenario.left.x =
    (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2 - 80;
  scenario.right.x =
    (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2 + 80;
  scenario.left.facing = -1;
  scenario.right.facing = 1;
  scenario.room.hitstopUntil = 0;
  scenario.room._foundationHitstopFreeze = false;
  timeoutManager.clearPlayer(scenario.left.id);
  timeoutManager.clearPlayer(scenario.right.id);
}

function serializeVolumes(volumes, { includeOwnerSlot = true } = {}) {
  return (volumes || []).map((v) => {
    const row = {
      kind: v.kind,
      label: v.label,
      mirrorFacing: v.mirrorFacing,
      tags: (v.tags || []).slice().sort(),
      left: round4(v.aabb.left),
      top: round4(v.aabb.top),
      right: round4(v.aabb.right),
      bottom: round4(v.aabb.bottom),
    };
    if (includeOwnerSlot) row.ownerSlot = v.ownerSlot;
    return row;
  });
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Capture a trace frame.
 * `comparable` strips harness ids / array slots so two fresh scenarios match.
 * Presentation/wall-clock IDs are never included.
 */
function captureTrace(scenario, opts = {}) {
  const comparable = !!opts.comparable;
  const now = scenario.room.simTime;
  const ordered = scenario.room.players;
  const frames = ordered.map((p, slot) => {
    const q = queryCombatVolumes(p, { simTime: now, ownerSlot: slot });
    return {
      slot,
      id: p.id,
      fighter: p.fighter || null,
      x: round4(p.x),
      y: round4(p.y),
      facing: p.facing,
      travelDirection: q.travelDirection,
      mirrorFacing: q.mirrorFacing,
      phase: q.actionPhase,
      tags: (q.tags || []).slice().sort(),
      volumes: serializeVolumes(q.volumes, { includeOwnerSlot: !comparable }),
      flags: {
        isAttacking: !!p.isAttacking,
        isSlapAttack: !!p.isSlapAttack,
        isPalmThrust: !!p.isPalmThrust,
        isChargingAttack: !!p.isChargingAttack,
        isGrabStartup: !!p.isGrabStartup,
        isDodging: !!p.isDodging,
        isSidestepping: !!p.isSidestepping,
        isSidestepStartup: !!p.isSidestepStartup,
        isSidestepRecovery: !!p.isSidestepRecovery,
        isRecovering: !!p.isRecovering,
        isHit: !!p.isHit,
        sizeMultiplier: p.sizeMultiplier || 1,
      },
    };
  });
  // Sort by fighter role for order-independent geometry compare.
  const byRole = frames
    .slice()
    .sort((a, b) => String(a.fighter).localeCompare(String(b.fighter)));
  const contacts = queryCandidateContacts(ordered[0], ordered[1], {
    simTime: now,
    ownerSlotA: 0,
    ownerSlotB: 1,
  });
  const candidateRows = contacts.candidates
    .map((c) => ({
      attackerKind: c.attackerKind,
      victimKind: c.victimKind,
      attackerLabel: c.attackerLabel,
      victimLabel: c.victimLabel,
      depth: round4(c.depth),
      x: round4(c.x),
      y: round4(c.y),
    }))
    .sort((a, b) => {
      const ka = `${a.attackerLabel}->${a.victimLabel}@${a.x}`;
      const kb = `${b.attackerLabel}->${b.victimLabel}@${b.x}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return {
    simTime: comparable ? 0 : now,
    hitstopFreeze: !!scenario.room._foundationHitstopFreeze,
    players: comparable ? undefined : frames,
    playersByRole: byRole.map((f) => ({
      fighter: f.fighter,
      x: f.x,
      y: f.y,
      facing: f.facing,
      mirrorFacing: f.mirrorFacing,
      travelDirection: f.travelDirection,
      phase: f.phase,
      tags: f.tags,
      volumes: f.volumes,
      flags: f.flags,
    })),
    // Back-compat alias used by early tests
    playersById: undefined,
    candidateCount: candidateRows.length,
    candidates: candidateRows,
  };
}

function tracesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Run the same script twice and return both traces (for determinism asserts).
 * script(scenario, api) may call api helpers.
 */
function runScript(scenario, script) {
  const api = {
    advance: (ms) => advanceSim(scenario, ms),
    tick: (n = 1) => {
      for (let i = 0; i < n; i++) {
        advanceSim(scenario, scenario.tickMs);
        stepPushbox(scenario, scenario.tickMs);
      }
    },
    pushbox: (ms) => stepPushbox(scenario, ms),
    collision: () => stepCollisionBothOrders(scenario),
    capture: () => captureTrace(scenario),
    freezeHitstop: (v) => freezeSimForHitstopCharacterization(scenario.room, v),
    reset: () => resetRematch(scenario),
  };
  return script(scenario, api);
}

module.exports = {
  DEFAULT_TICK_MS,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  GROUND_LEVEL,
  createFoundationScenario,
  freezeSimForHitstopCharacterization,
  advanceSim,
  stepPushbox,
  stepCollisionBothOrders,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  armLowKickPhase,
  armGrabStartup,
  armGrabWhiff,
  armDodge,
  armSidestepPhase,
  clearActionState,
  resetRematch,
  captureTrace,
  tracesEqual,
  runScript,
  serializeVolumes,
  // re-export timings for tests
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SIDESTEP_STARTUP_MS,
  SIDESTEP_ACTIVE_MS,
  SIDESTEP_RECOVERY_MS,
  DODGE_STARTUP_MS,
  DODGE_DURATION,
  GRAB_STARTUP_MS,
};

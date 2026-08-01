"use strict";

/**
 * Minimal strike/grab contact harness for Phase 13 baseline + V2 tests.
 */

const { createInitialPlayerState, createInitialKeys } = require("../../../playerFactory");
const {
  setSimRoomResolver,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../../gameUtils");
const { checkCollision, processHit } = require("../../../collisionSystem");
const { getConnectDistance } = require("../../../strikeContact");
const {
  GROUND_LEVEL,
  GRAB_STARTUP_DURATION_MS,
  GRAB_THROW_CATCH_START_MS,
  CHARGE_PRIORITY_THRESHOLD,
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  AP_LATE_PARRY_MS,
  GRAB_SLAP_CATCH_RANGE,
} = require("../../../constants");

/** Past slap startup + open-hit grace so processHit is not deferred. */
const SLAP_ACTIVE_TEST_OFFSET = SLAP_STARTUP_MS + AP_LATE_PARRY_MS + 15;
const { createMockIo } = require("../../clinch/harness/mockIo");

let harnessId = 0;

function createContactScenario(options = {}) {
  harnessId += 1;
  const id = harnessId;
  const simTime = options.simTime != null ? options.simTime : 200_000;
  const gap = options.gap != null ? options.gap : 90;
  const mid =
    options.midX != null
      ? options.midX
      : (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;

  const left = createInitialPlayerState({
    id: `left-${id}`,
    fighter: "player 1",
    x: mid - gap / 2,
    facing: -1, // faces right toward partner
    sizeMultiplier: 0.85,
  });
  const right = createInitialPlayerState({
    id: `right-${id}`,
    fighter: "player 2",
    x: mid + gap / 2,
    facing: 1, // faces left toward partner
    sizeMultiplier: 0.85,
  });
  left.keys = createInitialKeys();
  right.keys = createInitialKeys();
  left.y = GROUND_LEVEL;
  right.y = GROUND_LEVEL;

  const io = createMockIo();
  const room = {
    id: `contact-room-${id}`,
    simTime,
    gameStart: true,
    hakkiyoiCount: 3,
    gameOver: false,
    matchOver: false,
    hitstopUntil: 0,
    players: [left, right],
    lastScreenShakeTime: 0,
  };
  const rooms = [room];
  const byId = new Map([
    [left.id, room],
    [right.id, room],
  ]);
  setSimRoomResolver((playerId) => byId.get(playerId) || null);

  return {
    room,
    rooms,
    io,
    left,
    right,
    simTime,
    dispose() {
      setSimRoomResolver(null);
    },
  };
}

function armSlap(player, { startOffset = SLAP_ACTIVE_TEST_OFFSET, now } = {}) {
  const t = now != null ? now : 0;
  player.isAttacking = true;
  player.isSlapAttack = true;
  player.attackType = "slap";
  player.slapAnimation = 1;
  player.isInStartupFrames = false;
  player.attackStartTime = t - startOffset;
  player.attackEndTime = player.attackStartTime + 200;
  player.slapActiveEndTime = player.attackStartTime + 200;
  player.slapFacingDirection = player.facing;
  player.movementVelocity = 0;
  return player;
}

function armCharged(
  player,
  {
    power = CHARGE_PRIORITY_THRESHOLD + 10,
    startOffset = CHARGED_STARTUP_MS + 5,
    now,
  } = {}
) {
  const t = now != null ? now : 0;
  player.isAttacking = true;
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.attackType = "charged";
  player.chargeAttackPower = power;
  player.isInStartupFrames = false;
  player.attackStartTime = t - startOffset;
  player.attackEndTime = player.attackStartTime + 300;
  player.chargedActiveEndTime = player.attackStartTime + 300;
  player.chargingFacingDirection = player.facing;
  player.movementVelocity = player.facing === 1 ? -4 : 4;
  return player;
}

function armPalm(player, opts = {}) {
  armCharged(player, { power: 35, ...opts });
  player.isPalmThrust = true;
  player.movementVelocity = 0;
  return player;
}

function armGrabStartup(
  player,
  { elapsed = GRAB_THROW_CATCH_START_MS + 10, now } = {}
) {
  const t = now != null ? now : 0;
  player.isGrabStartup = true;
  player.grabStartupStartTime = t - elapsed;
  player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
  player.grabState = "attempting";
  player.currentAction = "grab_startup";
  return player;
}

function placeInConnectRange(attacker, defender, kind = "slap") {
  const dist = getConnectDistance(kind, attacker, defender);
  const dir = attacker.facing === 1 ? -1 : 1; // world travel toward facing
  // Park comfortably inside tip connect (and inside grab catch when used).
  const grabCatch =
    GRAB_SLAP_CATCH_RANGE * (attacker.sizeMultiplier || 1) - 8;
  const targetGap = Math.min(Math.max(40, dist - 20), Math.max(40, grabCatch));
  defender.x = attacker.x + dir * targetGap;
  // Keep facing each other
  if (attacker.x < defender.x) {
    attacker.facing = -1;
    defender.facing = 1;
  } else {
    attacker.facing = 1;
    defender.facing = -1;
  }
}

function runBothCollisionOrders(a, b, rooms, io) {
  checkCollision(a, b, rooms, io);
  checkCollision(b, a, rooms, io);
}

function snapshotOutcome(attacker, defender) {
  return {
    attackerAttacking: !!attacker.isAttacking,
    defenderAttacking: !!defender.isAttacking,
    attackerHit: !!attacker.isHit,
    defenderHit: !!defender.isHit,
    attackerType: attacker.attackType,
    defenderType: defender.attackType,
    attackerSlap: !!attacker.isSlapAttack,
    defenderSlap: !!defender.isSlapAttack,
    attackerPalm: !!attacker.isPalmThrust,
    defenderPalm: !!defender.isPalmThrust,
    defenderBalance: defender.balance,
    attackerBalance: attacker.balance,
    defenderStamina: defender.stamina,
    attackerKb: attacker.knockbackVelocity?.x || 0,
    defenderKb: defender.knockbackVelocity?.x || 0,
    consumedLoser: !!defender._combatContactConsumed || !!attacker._combatContactConsumed,
    lastOutcome: (attacker._lastCombatContactResolution ||
      defender._lastCombatContactResolution)?.outcome || null,
  };
}

module.exports = {
  createContactScenario,
  armSlap,
  armCharged,
  armPalm,
  armGrabStartup,
  placeInConnectRange,
  runBothCollisionOrders,
  snapshotOutcome,
  CHARGE_PRIORITY_THRESHOLD,
  GRAB_THROW_CATCH_START_MS,
  SLAP_ACTIVE_TEST_OFFSET,
  processHit,
  checkCollision,
  getConnectDistance,
};

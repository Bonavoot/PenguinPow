"use strict";

// Executes a sealed tachiai. Pure classification lives in tachiai.js.
// This file is required from index.js after gameFunctions has finished
// loading, so the action starters below are safe to call.

const {
  TACHIAI_LIVE_MS,
  TACHIAI_INPUT_GRACE_MS,
  TACHIAI_CHARGE_POWER,
  TACHIAI_CALL,
  TACHIAI_DODGE_HOP_HEIGHT,
  TACHIAI_DODGE_HOP_MS,
  sealTachiai,
  isTachiaiLive,
  markTachiaiAction,
} = require("./tachiai");
const {
  executeSlapAttack,
  executeChargedAttack,
  executePalmThrust,
} = require("./gameFunctions");
const {
  simNow,
  beginGrabStartup,
  beginPlayerDodge,
  beginSidestep,
  armAttackParry,
  armMatador,
  canArmAttackParry,
  canArmMatador,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");
const { beginCommandGrab } = require("./commandGrabSystem");

function opponentOf(room, player) {
  return (room.players || []).find((p) => p !== player) || null;
}

function directionToward(player, opponent) {
  if (!opponent) return player.facing === 1 ? -1 : 1;
  return player.x <= opponent.x ? 1 : -1;
}

function commitOne(room, rooms, player, call) {
  const now = simNow(room);
  const opponent = opponentOf(room, player);
  if (call === TACHIAI_CALL.SLAP) {
    executeSlapAttack(player, rooms);
    return;
  }
  if (call === TACHIAI_CALL.CHARGE) {
    executeChargedAttack(player, TACHIAI_CHARGE_POWER, rooms);
    return;
  }
  if (call === TACHIAI_CALL.PALM) {
    executePalmThrust(player, rooms);
    return;
  }
  if (call === TACHIAI_CALL.GRAB) {
    beginGrabStartup(player, room);
    return;
  }
  if (call === TACHIAI_CALL.HENKA && opponent) {
    beginSidestep(player, opponent, now, { immediate: true });
    return;
  }
  if (call === TACHIAI_CALL.DODGE_IN || call === TACHIAI_CALL.DODGE_BACK) {
    const toward = directionToward(player, opponent);
    beginPlayerDodge(player, {
      nowSim: now,
      direction: call === TACHIAI_CALL.DODGE_BACK ? -toward : toward,
      hopHeight: TACHIAI_DODGE_HOP_HEIGHT,
      hopMs: TACHIAI_DODGE_HOP_MS,
    });
    return;
  }
  if (call === TACHIAI_CALL.PARRY && canArmAttackParry(player, now)) {
    armAttackParry(player, now, now);
    return;
  }
  if (call === TACHIAI_CALL.MATADOR && canArmMatador(player, now)) {
    armMatador(player, now, now);
  }
}

function grabBeatsHenka(grabber, victim, room) {
  const now = simNow(room);
  grabber.tachiaiUntil = now + TACHIAI_LIVE_MS;
  victim.tachiaiUntil = now + TACHIAI_LIVE_MS;
  grabber.isGrabbing = true;
  grabber.grabbedOpponent = victim.id;
  grabber.inClinch = true;
  grabber.hasGrip = true;
  victim.isBeingGrabbed = true;
  victim.inClinch = true;
  victim.hasGrip = true;
  markTachiaiAction(grabber, TACHIAI_CALL.GRAB, now);
  markTachiaiAction(victim, TACHIAI_CALL.HENKA, now);
  beginCommandGrab(grabber, victim, room, room._tachiaiIo);
}

/**
 * Start every sealed call. A grab versus a sidestep does not race the arc:
 * the grab connects immediately and the push is the devastating one.
 */
function commitTachiai(room, rooms, io) {
  if (!room || room.tachiaiCommitted) return null;
  sealTachiai(room);
  room.tachiaiCommitted = true;
  room._tachiaiIo = io;
  const players = room.players || [];
  const now = simNow(room);
  for (const player of players) {
    player.tachiaiUntil = now + TACHIAI_LIVE_MS;
    player.tachiaiInputGraceUntil = now + TACHIAI_INPUT_GRACE_MS;
    if (!player.tachiaiCall) player.tachiaiCall = TACHIAI_CALL.STAND;
    player.tachiaiLaunched = player.tachiaiCall !== TACHIAI_CALL.STAND;
  }

  const [a, b] = players;
  if (a && b) {
    const grabber = a.tachiaiCall === TACHIAI_CALL.GRAB && b.tachiaiCall === TACHIAI_CALL.HENKA
      ? a
      : b.tachiaiCall === TACHIAI_CALL.GRAB && a.tachiaiCall === TACHIAI_CALL.HENKA
        ? b
        : null;
    const victim = grabber && (grabber === a ? b : a);
    if (grabber && victim) {
      grabBeatsHenka(grabber, victim, room);
    } else {
      for (const player of players) {
        if (player.tachiaiCall && player.tachiaiCall !== TACHIAI_CALL.STAND) {
          commitOne(room, rooms, player, player.tachiaiCall);
        }
      }
    }
    const human = players.find((p) => !p.isCPU);
    const cpu = players.find((p) => p.isCPU);
    if (cpu && human) cpu.tachiaiMemory = human.tachiaiCall || TACHIAI_CALL.STAND;
  } else {
    for (const player of players) {
      if (player.tachiaiCall && player.tachiaiCall !== TACHIAI_CALL.STAND) {
        commitOne(room, rooms, player, player.tachiaiCall);
      }
    }
  }

  return null;
}

function retargetHenkaDrive(grabber, victim, now) {
  if (!isTachiaiLive(victim, now) || victim.tachiaiCall !== TACHIAI_CALL.HENKA) return;
  if (!isTachiaiLive(grabber, now) || grabber.tachiaiCall !== TACHIAI_CALL.GRAB) return;
  const dir = grabber.cmdGrabCarryDir || (grabber.x < victim.x ? 1 : -1);
  const ropeX = dir > 0 ? MAP_RIGHT_BOUNDARY : MAP_LEFT_BOUNDARY;
  const attach = grabber.cmdGrabCarryAttachTo || Math.abs(grabber.x - victim.x) || 80;
  grabber.cmdGrabCarryTargetX = ropeX - dir * attach;
  victim.tachiaiRopeAfterDrive = true;
}

module.exports = {
  commitTachiai,
  retargetHenkaDrive,
};

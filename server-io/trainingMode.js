/**
 * Training lab — a solo CPU room that starts already live.
 *
 * Firewall: nothing here is consulted by PvP, VS CPU, or BASHO except
 * `isTrainingRoom()` early-returns. Dummy behaviors live on
 * `room.cpuTrainingBehavior`; difficulty modes reuse the existing CPU brain.
 */

const { BALANCE_MAX } = require("./constants");

const TRAINING_CPU_MAWASHI = "#4169E1"; // stock sprite — skip client recolor
const PLAYER_1_READY_X = 543;
const PLAYER_2_READY_X = 735;

const TRAINING_BEHAVIORS = {
  standby: { kind: "dummy" },
  slap: { kind: "dummy" },
  palm: { kind: "dummy" },
  grab: { kind: "dummy" },
  EASY: { kind: "ai", difficulty: "EASY" },
  NORMAL: { kind: "ai", difficulty: "NORMAL" },
  IMPOSSIBLE: { kind: "ai", difficulty: "IMPOSSIBLE" },
};

function isTrainingRoom(room) {
  return !!(room && room.matchMode === "training");
}

function normalizeTrainingBehavior(behavior) {
  return behavior && TRAINING_BEHAVIORS[behavior] ? behavior : "standby";
}

function applyTrainingBehavior(room, behavior) {
  const next = normalizeTrainingBehavior(behavior);
  room.cpuTrainingBehavior = next;
  const spec = TRAINING_BEHAVIORS[next];
  if (spec.kind === "ai") {
    room.cpuDifficulty = spec.difficulty;
  }
  return next;
}

function armTrainingLive(room) {
  room.gameStart = true;
  room.gameOver = false;
  room.matchOver = false;
  room.hakkiyoiCount = 1;
  room.gameOverTime = null;
  room.boutEndsAtSim = null;
  room.boutSecondsShown = null;
  room.boutCardSent = false;
  room.boutCardAtSim = null;
  room.powerUpSelectionPhase = false;
  room.readyStartTime = null;
  room.teWoTsuiteSent = false;
  room.trainingResetPending = false;
  delete room.winnerId;
  delete room.loserId;
}

function applyTrainingInfiniteResources(room, enabled) {
  room.trainingInfiniteResources = !!enabled;
  return room.trainingInfiniteResources;
}

function refillTrainingResources(player) {
  if (!player) return;
  player.stamina = 100;
  player.balance = BALANCE_MAX;
  player.isGassed = false;
  player.gassedUntil = 0;
  player.isPostureBroken = false;
}

function trainingSettingsPayload(room) {
  return {
    behavior: room.cpuTrainingBehavior || "standby",
    infiniteResources: !!room.trainingInfiniteResources,
  };
}

function snapTrainingPositions(player) {
  const isP1 = player.fighter === "player 1";
  player.x = isP1 ? PLAYER_1_READY_X : PLAYER_2_READY_X;
  // facing 1 = left, -1 = right — face each other on the ready marks.
  player.facing = isP1 ? -1 : 1;
  player.isReady = false;
  player.canMoveToReady = false;
  player.isInRitualPhase = false;
  player.isThrowingSalt = false;
  player.saltCooldown = false;
}

module.exports = {
  TRAINING_CPU_MAWASHI,
  PLAYER_1_READY_X,
  PLAYER_2_READY_X,
  TRAINING_BEHAVIORS,
  isTrainingRoom,
  normalizeTrainingBehavior,
  applyTrainingBehavior,
  applyTrainingInfiniteResources,
  refillTrainingResources,
  trainingSettingsPayload,
  armTrainingLive,
  snapTrainingPositions,
};

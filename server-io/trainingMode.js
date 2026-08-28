/**
 * Training lab — a solo CPU room that starts already live.
 *
 * Firewall: nothing here is consulted by PvP, VS CPU, or BASHO except
 * `isTrainingRoom()` early-returns. Dummy behaviors live on
 * `room.cpuTrainingBehavior`; difficulty modes reuse the existing CPU brain.
 *
 * Kits reuse the BASHO draft + loadout flag objects so combat math already
 * works (`player.bashoDraft?.x ?? neutral`, `player.loadout?.flag`). Those
 * objects are attached here only — PvP / VS CPU never pass through this file.
 */

const { BALANCE_MAX, POWER_UP_TYPES } = require("./constants");
const { deriveBashoDraft, normalizeBashoDraftList } = require("./bashoDraft");
const { deriveLoadout } = require("./bashoLoadout");

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

const TRAINING_STACK_CAP = 7;
const TRAINING_ACTIVES = [POWER_UP_TYPES.SNOWBALL, POWER_UP_TYPES.PUMO_ARMY];
const TRAINING_STACKS = [POWER_UP_TYPES.SPEED, POWER_UP_TYPES.POWER];
const TRAINING_TECHS = {
  flap: { category: "movement", id: "flap" },
  shattering_palm: { category: "attack", id: "shattering_palm" },
  thick_blubber: { category: "grappling", id: "thick_blubber" },
};

function emptyTrainingLoadout() {
  return {
    attack: [],
    defense: [],
    movement: [],
    grappling: [],
    shinto: [],
  };
}

function emptyTrainingKit() {
  return {
    draft: [],
    loadout: emptyTrainingLoadout(),
  };
}

function emptyTrainingKits() {
  return {
    human: emptyTrainingKit(),
    cpu: emptyTrainingKit(),
  };
}

function emptyTrainingKitView() {
  return {
    active: null,
    stacks: { speed: 0, power: 0 },
    techs: {
      flap: false,
      shattering_palm: false,
      thick_blubber: false,
    },
  };
}

function ensureTrainingKits(room) {
  if (!room.trainingKits) room.trainingKits = emptyTrainingKits();
  if (!room.trainingKits.human) room.trainingKits.human = emptyTrainingKit();
  if (!room.trainingKits.cpu) room.trainingKits.cpu = emptyTrainingKit();
  if (!room.trainingKits.human.loadout) {
    room.trainingKits.human.loadout = emptyTrainingLoadout();
  }
  if (!room.trainingKits.cpu.loadout) {
    room.trainingKits.cpu.loadout = emptyTrainingLoadout();
  }
  return room.trainingKits;
}

function countDraft(list, type) {
  return list.reduce((n, id) => (id === type ? n + 1 : n), 0);
}

function summarizeTrainingKit(kit) {
  const list = normalizeBashoDraftList(kit?.draft || []);
  const loadout = kit?.loadout || emptyTrainingLoadout();
  let active = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (TRAINING_ACTIVES.includes(list[i])) {
      active = list[i];
      break;
    }
  }
  return {
    active,
    stacks: {
      speed: countDraft(list, POWER_UP_TYPES.SPEED),
      power: countDraft(list, POWER_UP_TYPES.POWER),
    },
    techs: {
      flap:
        (loadout.movement || []).includes("flap") ||
        (loadout.defense || []).includes("flap"),
      shattering_palm: (loadout.attack || []).includes("shattering_palm"),
      thick_blubber: (loadout.grappling || []).includes("thick_blubber"),
    },
  };
}

function mutateTrainingKit(kit, { op, type } = {}) {
  if (!kit) return kit;
  if (!Array.isArray(kit.draft)) kit.draft = [];
  if (!kit.loadout) kit.loadout = emptyTrainingLoadout();

  if (op === "clear") {
    kit.draft = [];
    kit.loadout = emptyTrainingLoadout();
    return kit;
  }

  if (op === "toggle_active" && TRAINING_ACTIVES.includes(type)) {
    const alreadyOn = kit.draft.includes(type);
    kit.draft = kit.draft.filter((t) => !TRAINING_ACTIVES.includes(t));
    if (!alreadyOn) kit.draft.push(type);
    return kit;
  }

  if (op === "add_stack" && TRAINING_STACKS.includes(type)) {
    if (countDraft(kit.draft, type) < TRAINING_STACK_CAP) kit.draft.push(type);
    return kit;
  }

  if (op === "remove_stack" && TRAINING_STACKS.includes(type)) {
    const i = kit.draft.lastIndexOf(type);
    if (i !== -1) kit.draft.splice(i, 1);
    return kit;
  }

  if (op === "toggle_tech" && TRAINING_TECHS[type]) {
    const { category, id } = TRAINING_TECHS[type];
    const list = Array.isArray(kit.loadout[category])
      ? kit.loadout[category]
      : [];
    kit.loadout[category] = list.includes(id)
      ? list.filter((entry) => entry !== id)
      : [...list, id];
    return kit;
  }

  return kit;
}

function applyTrainingKitToPlayer(player, kit, opts = {}) {
  if (!player) return;
  const refresh = !!opts.refreshActives;
  const list = normalizeBashoDraftList(kit?.draft || []);
  const draft = deriveBashoDraft(list);
  const hadSnow = !!player.bashoDraft?.snowball;
  const hadPumo = !!player.bashoDraft?.pumo;

  player.draftedPowerUps = list;
  player.bashoDraft = draft;
  // Same bypass as BASHO: combat reads the draft object, not the PvP slot.
  player.activePowerUp = null;
  player.powerUpMultiplier = 1;
  player.loadout = deriveLoadout(kit?.loadout || {});

  if (draft.snowball) {
    if (refresh || !hadSnow || player.snowballThrowsRemaining == null) {
      player.snowballThrowsRemaining = draft.snowballThrows;
    }
  } else {
    player.snowballThrowsRemaining = null;
  }

  if (draft.pumo) {
    if (refresh || !hadPumo || player.pumoArmySpawnsRemaining == null) {
      player.pumoArmySpawnsRemaining = draft.pumoSpawns;
    }
  } else {
    player.pumoArmySpawnsRemaining = null;
  }

  player.bashoBlubberRemaining = draft.blubberCharges;
}

function applyTrainingKitsToRoom(room, opts = {}) {
  if (!isTrainingRoom(room)) return;
  const kits = ensureTrainingKits(room);
  room.players.forEach((player) => {
    applyTrainingKitToPlayer(
      player,
      player.isCPU ? kits.cpu : kits.human,
      opts
    );
  });
}

function setTrainingKit(room, data = {}) {
  if (!isTrainingRoom(room)) return null;
  const kits = ensureTrainingKits(room);
  const side = data.target === "cpu" ? "cpu" : "human";
  mutateTrainingKit(kits[side], { op: data.op, type: data.type });
  applyTrainingKitsToRoom(room);
  return trainingSettingsPayload(room);
}

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
  const kits = ensureTrainingKits(room);
  return {
    behavior: room.cpuTrainingBehavior || "standby",
    infiniteResources: !!room.trainingInfiniteResources,
    kits: {
      human: summarizeTrainingKit(kits.human),
      cpu: summarizeTrainingKit(kits.cpu),
    },
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
  TRAINING_STACK_CAP,
  TRAINING_ACTIVES,
  TRAINING_STACKS,
  isTrainingRoom,
  normalizeTrainingBehavior,
  applyTrainingBehavior,
  applyTrainingInfiniteResources,
  refillTrainingResources,
  emptyTrainingKits,
  emptyTrainingKitView,
  ensureTrainingKits,
  summarizeTrainingKit,
  mutateTrainingKit,
  applyTrainingKitToPlayer,
  applyTrainingKitsToRoom,
  setTrainingKit,
  trainingSettingsPayload,
  armTrainingLive,
  snapTrainingPositions,
};

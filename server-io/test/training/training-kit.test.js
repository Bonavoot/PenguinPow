const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createInitialPlayerState } = require("../../playerFactory");
const {
  emptyTrainingKitView,
  emptyTrainingKits,
  mutateTrainingKit,
  summarizeTrainingKit,
  applyTrainingKitToPlayer,
  applyTrainingKitsToRoom,
  setTrainingKit,
  TRAINING_STACK_CAP,
} = require("../../trainingMode");

function kit() {
  return emptyTrainingKits().human;
}

describe("training kit — mutations", () => {
  it("toggles F-key actives on and off", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "toggle_active", type: "snowball" });
    assert.equal(summarizeTrainingKit(k).active, "snowball");
    mutateTrainingKit(k, { op: "toggle_active", type: "snowball" });
    assert.equal(summarizeTrainingKit(k).active, null);
  });

  it("replaces snowball with pumo army instead of stacking both", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "toggle_active", type: "snowball" });
    mutateTrainingKit(k, { op: "toggle_active", type: "pumo_army" });
    assert.deepEqual(summarizeTrainingKit(k).active, "pumo_army");
    assert.equal(k.draft.includes("snowball"), false);
  });

  it("adds and removes happy feet / power water stacks", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "add_stack", type: "speed" });
    mutateTrainingKit(k, { op: "add_stack", type: "speed" });
    mutateTrainingKit(k, { op: "add_stack", type: "power" });
    assert.deepEqual(summarizeTrainingKit(k).stacks, { speed: 2, power: 1 });
    mutateTrainingKit(k, { op: "remove_stack", type: "speed" });
    assert.deepEqual(summarizeTrainingKit(k).stacks, { speed: 1, power: 1 });
  });

  it("caps stacks and will not go below zero", () => {
    const k = kit();
    for (let i = 0; i < TRAINING_STACK_CAP + 3; i++) {
      mutateTrainingKit(k, { op: "add_stack", type: "power" });
    }
    assert.equal(summarizeTrainingKit(k).stacks.power, TRAINING_STACK_CAP);
    mutateTrainingKit(k, { op: "remove_stack", type: "speed" });
    assert.equal(summarizeTrainingKit(k).stacks.speed, 0);
  });

  it("toggles loadout techniques independently", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "toggle_tech", type: "flap" });
    mutateTrainingKit(k, { op: "toggle_tech", type: "shattering_palm" });
    const view = summarizeTrainingKit(k);
    assert.equal(view.techs.flap, true);
    assert.equal(view.techs.shattering_palm, true);
    assert.equal(view.techs.thick_blubber, false);
    mutateTrainingKit(k, { op: "toggle_tech", type: "flap" });
    assert.equal(summarizeTrainingKit(k).techs.flap, false);
  });

  it("clear strips draft and techniques", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "toggle_active", type: "snowball" });
    mutateTrainingKit(k, { op: "add_stack", type: "speed" });
    mutateTrainingKit(k, { op: "toggle_tech", type: "thick_blubber" });
    mutateTrainingKit(k, { op: "clear" });
    assert.deepEqual(summarizeTrainingKit(k), emptyTrainingKitView());
  });
});

describe("training kit — apply to fighter", () => {
  it("writes bashoDraft speed/power and loadout flags", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "add_stack", type: "speed" });
    mutateTrainingKit(k, { op: "add_stack", type: "power" });
    mutateTrainingKit(k, { op: "toggle_tech", type: "flap" });
    mutateTrainingKit(k, { op: "toggle_tech", type: "shattering_palm" });
    mutateTrainingKit(k, { op: "toggle_tech", type: "thick_blubber" });
    const player = createInitialPlayerState({ id: "p1" });
    applyTrainingKitToPlayer(player, k, { refreshActives: true });
    assert.ok((player.bashoDraft?.speedMult ?? 1) > 1);
    assert.ok((player.bashoDraft?.powerMult ?? 1) > 1);
    assert.equal(player.loadout.hasFlap, true);
    assert.equal(player.loadout.palmBreaksGrabArmor, true);
    assert.equal(player.loadout.thickBlubberGrabs, true);
    assert.equal(player.activePowerUp, null);
  });

  it("grants snowball throws and keeps remaining uses when stacking feet", () => {
    const k = kit();
    mutateTrainingKit(k, { op: "toggle_active", type: "snowball" });
    const player = createInitialPlayerState({ id: "p1" });
    applyTrainingKitToPlayer(player, k, { refreshActives: true });
    assert.equal(player.bashoDraft.snowball, true);
    assert.equal(player.snowballThrowsRemaining, 5);
    player.snowballThrowsRemaining = 2;
    mutateTrainingKit(k, { op: "add_stack", type: "speed" });
    applyTrainingKitToPlayer(player, k);
    assert.equal(player.snowballThrowsRemaining, 2);
    assert.ok(player.bashoDraft.speedMult > 1);
  });

  it("does not attach kits to a non-training room", () => {
    const player = createInitialPlayerState({ id: "p1" });
    const room = {
      matchMode: "cpu",
      trainingKits: emptyTrainingKits(),
      players: [player],
    };
    room.trainingKits.human.draft = ["speed"];
    applyTrainingKitsToRoom(room);
    assert.equal(player.bashoDraft, undefined);
  });

  it("setTrainingKit targets human vs cpu separately", () => {
    const human = createInitialPlayerState({ id: "human" });
    const cpu = createInitialPlayerState({ id: "cpu", isCPU: true });
    const room = {
      matchMode: "training",
      cpuTrainingBehavior: "standby",
      trainingInfiniteResources: false,
      trainingKits: emptyTrainingKits(),
      players: [human, cpu],
    };
    const settings = setTrainingKit(room, {
      target: "cpu",
      op: "add_stack",
      type: "speed",
    });
    assert.equal(settings.kits.cpu.stacks.speed, 1);
    assert.equal(settings.kits.human.stacks.speed, 0);
    assert.ok(cpu.bashoDraft.speedMult > 1);
    assert.equal(human.bashoDraft.speedMult, 1);
  });
});

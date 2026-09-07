"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  DODGE_TRAVEL_DISTANCE,
  CHARGE_HOP_DISTANCE,
  CHARGE_HOP_MS,
  CHARGE_LAND_HOLD_MS,
  CHARGE_MIN_HOLD_MS,
  CHARGED_STARTUP_MS,
} = require("../../constants");
const { createInitialPlayerState } = require("../../playerFactory");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  setSimRoomResolver,
  beginChargeHold,
  beginChargeHop,
  cancelChargeHop,
  stepChargeHop,
  canReleaseChargedAttack,
  clearChargeState,
} = require("../../gameUtils");
const {
  requestChargedAttackRelease,
  flushBufferedChargeRelease,
  executeChargedAttack,
} = require("../../gameFunctions");

let room;
const playersById = new Map();

function makePlayer(overrides = {}) {
  const p = createInitialPlayerState({
    id: overrides.id || "charger",
    x: 600,
    y: GROUND_LEVEL,
    facing: -1,
    stamina: 100,
    keys: { mouse1: true, s: true, a: true, d: false },
    ...overrides,
  });
  playersById.set(p.id, p);
  return p;
}

function roomsFor(player) {
  return [room];
}

before(() => {
  setSimRoomResolver((id) => (playersById.has(id) ? room : null));
});

after(() => {
  setSimRoomResolver(null);
});

describe("charge-hold hop-back + min hold", () => {
  it("min hold is hop plus landing plant", () => {
    assert.equal(CHARGE_MIN_HOLD_MS, CHARGE_HOP_MS + CHARGE_LAND_HOLD_MS);
    assert.ok(CHARGE_MIN_HOLD_MS > CHARGE_HOP_MS);
  });

  it("hop travels farther than a dodge and away from facing", () => {
    room = { id: "r", simTime: 1000, players: [] };
    const opp = makePlayer({ id: "opp", x: 720, facing: 1 });
    const p = makePlayer({ id: "p1", x: 600, facing: 1 });
    room.players = [p, opp];
    beginChargeHold(p, roomsFor(p));
    assert.equal(p.isChargingAttack, true);
    assert.equal(p.isChargeHopping, true);
    assert.equal(p.facing, -1, "faces opponent to the right");
    assert.equal(p.chargeHopDirection, -1, "hops back (−X)");
    assert.ok(CHARGE_HOP_DISTANCE > DODGE_TRAVEL_DISTANCE);
    assert.equal(p.chargeHopTargetX, 600 - CHARGE_HOP_DISTANCE);
    stepChargeHop(p, room.simTime + CHARGE_HOP_MS);
    assert.equal(p.isChargeHopping, false);
    assert.equal(p.x, 600 - CHARGE_HOP_DISTANCE);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("near-rope hop clamps to map bounds", () => {
    room = { id: "r", simTime: 2000, players: [] };
    const opp = makePlayer({ id: "opp2", x: 500, facing: 1 });
    const p = makePlayer({ id: "p2", x: MAP_LEFT_BOUNDARY + 8, facing: 1 });
    room.players = [p, opp];
    beginChargeHold(p, roomsFor(p));
    assert.equal(p.facing, -1);
    assert.equal(p.chargeHopTargetX, MAP_LEFT_BOUNDARY);
    stepChargeHop(p, room.simTime + CHARGE_HOP_MS);
    assert.equal(p.x, MAP_LEFT_BOUNDARY);
    assert.ok(p.x >= MAP_LEFT_BOUNDARY);
    assert.ok(p.x <= MAP_RIGHT_BOUNDARY);
  });

  it("tap does not execute before min hold; buffered tap fires at min hold", () => {
    room = { id: "r", simTime: 3000, players: [] };
    const opp = makePlayer({ id: "opp3", x: 720, facing: 1 });
    const p = makePlayer({ id: "p3", x: 600, facing: -1 });
    room.players = [p, opp];
    beginChargeHold(p, roomsFor(p));
    p.keys.mouse1 = false;
    const firedEarly = requestChargedAttackRelease(p, roomsFor(p));
    assert.equal(firedEarly, false);
    assert.equal(p.isChargingAttack, true);
    assert.equal(p.chargeReleaseBuffered, true);
    assert.equal(p.isAttacking, false);
    assert.equal(canReleaseChargedAttack(p, room.simTime), false);

    room.simTime += CHARGE_HOP_MS;
    stepChargeHop(p, room.simTime);
    assert.equal(p.isChargeHopping, false);
    assert.equal(
      canReleaseChargedAttack(p, room.simTime),
      false,
      "hop land is not enough — landing plant must hold"
    );

    room.simTime += CHARGE_LAND_HOLD_MS;
    const fired = flushBufferedChargeRelease(p, roomsFor(p));
    assert.equal(fired, true);
    assert.equal(p.isChargingAttack, false);
    assert.equal(p.isAttacking, true);
    assert.equal(p.attackType, "charged");
  });

  it("held past min still fires on the real release edge", () => {
    room = { id: "r", simTime: 4000, players: [] };
    const opp = makePlayer({ id: "opp4", x: 720, facing: 1 });
    const p = makePlayer({ id: "p4", x: 600, facing: -1 });
    room.players = [p, opp];
    beginChargeHold(p, roomsFor(p));
    room.simTime += CHARGE_MIN_HOLD_MS + 50;
    p.keys.mouse1 = false;
    const fired = requestChargedAttackRelease(p, roomsFor(p));
    assert.equal(fired, true);
    assert.equal(p.isAttacking, true);
    assert.equal(p.attackType, "charged");
    assert.equal(p.chargeReleaseBuffered, false);
  });

  it("clearChargeState grounds hop Y and clears hop flags", () => {
    room = { id: "r", simTime: 5000, players: [] };
    const p = makePlayer({ id: "p5", x: 600, facing: -1 });
    room.players = [p];
    beginChargeHop(p);
    p.y = GROUND_LEVEL + 12;
    p.isChargingAttack = true;
    clearChargeState(p, true);
    assert.equal(p.isChargeHopping, false);
    assert.equal(p.chargeReleaseBuffered, false);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("CHARGED_STARTUP_MS is still 150 (distance compensation), release is live", () => {
    room = { id: "r", simTime: 6000, players: [] };
    const opp = makePlayer({ id: "opp6", x: 720, facing: 1 });
    const p = makePlayer({ id: "p6", x: 600, facing: -1 });
    room.players = [p, opp];
    executeChargedAttack(p, 40, roomsFor(p));
    assert.equal(CHARGED_STARTUP_MS, 150);
    assert.equal(p.startupEndTime, p.attackStartTime);
    assert.equal(p.isInStartupFrames, false);
  });
});

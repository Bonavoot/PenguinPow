"use strict";

/**
 * Matador success yank — spends the grabber's grabApproachSpeed.
 * Command-grab Pull is the belt tug; this is the dump.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveMatadorPull } = require("../../gameFunctions");
const { createInitialPlayerState, createInitialKeys } = require("../../playerFactory");
const { createMockIo } = require("../helpers/mockIo");
const { profileFor, transfer, V_REF } = require("../../momentumTransfer");
const { GROUND_LEVEL } = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

function makePair({ grabApproachSpeed = 0, grabberX = 480, matadorX = 560 } = {}) {
  const matador = createInitialPlayerState({
    id: "matador",
    fighter: "player 1",
    x: matadorX,
    facing: 1,
    stamina: 100,
    balance: 100,
  });
  const grabber = createInitialPlayerState({
    id: "grabber",
    fighter: "player 2",
    x: grabberX,
    facing: -1,
    stamina: 100,
    balance: 100,
  });
  for (const p of [matador, grabber]) {
    p.keys = createInitialKeys();
    p.y = GROUND_LEVEL;
    p.knockbackVelocity = { x: 0, y: 0 };
  }
  grabber.grabApproachSpeed = grabApproachSpeed;
  grabber.isGrabStartup = true;

  const io = createMockIo();
  const room = {
    id: "matador-room",
    simTime: 100_000,
    gameStart: true,
    hakkiyoiCount: 3,
    gameOver: false,
    matchOver: false,
    hitstopUntil: 0,
    players: [matador, grabber],
    lastScreenShakeTime: 0,
  };
  return { matador, grabber, room, io };
}

test("matador yank spends grab entry speed", async (t) => {
  await t.test("a standing grab still dumps past the floor of the old fixed yank", () => {
    const { matador, grabber, room, io } = makePair({ grabApproachSpeed: 0 });
    resolveMatadorPull(matador, grabber, room, io);
    const sent = Math.abs(grabber.grabBreakTargetX - matador.x);
    const floor = profileFor("matador").floor;
    assert.ok(
      Math.abs(sent - floor) < 2,
      `standing-grab matador should send the floor (${floor}), got ${sent}`
    );
    assert.ok(sent > 224, "must out-send the old fixed 224px yank");
    assert.equal(grabber.isBeingPullReversaled, true);
  });

  await t.test("a slide-in grab buys the ceiling", () => {
    const { matador, grabber, room, io } = makePair({
      grabApproachSpeed: V_REF,
      grabberX: 420,
      matadorX: 500,
    });
    resolveMatadorPull(matador, grabber, room, io);
    const sent = Math.abs(grabber.grabBreakTargetX - matador.x);
    const ceil = profileFor("matador").ceil;
    assert.ok(
      Math.abs(sent - ceil) < 2,
      `slide-in matador should send the ceiling (${ceil}), got ${sent}`
    );
    const mid = MAP_LEFT_BOUNDARY + (MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY) / 2;
    assert.ok(
      matador.x < mid,
      "place the dump where the ceiling can land inside the ring"
    );
  });

  await t.test("the live transfer curve is what resolveMatadorPull uses", () => {
    const walk = 1.3;
    const expected = Math.round(
      transfer(walk, profileFor("matador").floor, profileFor("matador").ceil)
    );
    const { matador, grabber, room, io } = makePair({
      grabApproachSpeed: walk,
      grabberX: 420,
      matadorX: 500,
    });
    resolveMatadorPull(matador, grabber, room, io);
    const sent = Math.abs(grabber.grabBreakTargetX - matador.x);
    assert.equal(sent, expected);
  });
});

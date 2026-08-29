"use strict";

/**
 * Dodge hop and ice-slide reverse hop write world Y above GROUND_LEVEL.
 * If those hops are cancelled (or a grounded action starts) without snapping Y,
 * parry/grab freeze the fighter in the air — gravity-snap used to live inside
 * the strafe gate, which those actions skip.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  ICE_SLIDE_REVERSE_HOP_HEIGHT,
} = require("../../constants");
const { createInitialPlayerState } = require("../../playerFactory");
const {
  groundPlayerIfNotAirborne,
  cancelDodgeHop,
  clearIceSlideState,
  beginGrabStartup,
  armAttackParry,
  armMatador,
  enterGuard,
  beginPlayerDodge,
} = require("../../gameUtils");

function hopY() {
  return GROUND_LEVEL + ICE_SLIDE_REVERSE_HOP_HEIGHT;
}

function makePlayer(overrides = {}) {
  return createInitialPlayerState({
    id: "hopper",
    x: 500,
    y: hopY(),
    facing: -1,
    ...overrides,
  });
}

describe("grounded hop Y — leftover dodge / reverse-hop elevation", () => {
  it("groundPlayerIfNotAirborne snaps leftover hop Y", () => {
    const p = makePlayer();
    assert.equal(groundPlayerIfNotAirborne(p), true);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("groundPlayerIfNotAirborne leaves real aerial Y alone", () => {
    const p = makePlayer({ isSlideJumping: true, y: hopY() + 40 });
    assert.equal(groundPlayerIfNotAirborne(p), false);
    assert.equal(p.y, hopY() + 40);
  });

  it("cancelDodgeHop clears dodge flags and snaps Y", () => {
    const p = makePlayer({
      isDodging: true,
      isDodgeStartup: true,
      dodgeDirection: 1,
    });
    cancelDodgeHop(p);
    assert.equal(p.isDodging, false);
    assert.equal(p.isDodgeStartup, false);
    assert.equal(p.dodgeDirection, null);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("clearIceSlideState snaps Y when a reverse hop is killed", () => {
    const p = makePlayer({
      isIceSliding: true,
      isIceSlideReverseHopping: true,
      iceSlideDir: 1,
    });
    clearIceSlideState(p);
    assert.equal(p.isIceSlideReverseHopping, false);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("clearIceSlideState does not flatten an already-latched slide jump", () => {
    const airY = hopY() + 20;
    const p = makePlayer({
      isIceSliding: true,
      isIceSlideReverseHopping: true,
      isSlideJumping: true,
      y: airY,
    });
    clearIceSlideState(p);
    assert.equal(p.y, airY);
  });

  it("beginGrabStartup snaps leftover hop Y (startup tick returns before gravity)", () => {
    const grabber = makePlayer({ keys: { mouse2: true } });
    const other = createInitialPlayerState({
      id: "other",
      x: 620,
      y: GROUND_LEVEL,
      facing: 1,
    });
    const room = { id: "r", players: [grabber, other], simTime: 1000 };
    beginGrabStartup(grabber, room);
    assert.equal(grabber.isGrabStartup, true);
    assert.equal(grabber.y, GROUND_LEVEL);
  });

  it("armAttackParry snaps leftover hop Y (parry skips the strafe/gravity gate)", () => {
    const p = makePlayer();
    armAttackParry(p, 1000);
    assert.equal(p.isRawParrying, true);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("enterGuard snaps leftover hop Y", () => {
    const p = makePlayer();
    enterGuard(p);
    assert.equal(p.isGuarding, true);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("armMatador snaps leftover hop Y", () => {
    const p = makePlayer();
    armMatador(p, 1000);
    assert.equal(p.isMatadorParrying, true);
    assert.equal(p.y, GROUND_LEVEL);
  });

  it("beginPlayerDodge starts the hop from GROUND_LEVEL", () => {
    const p = makePlayer({
      keys: { d: true },
      stamina: 100,
    });
    assert.equal(beginPlayerDodge(p, { nowSim: 1000, skipStartup: true }), true);
    assert.equal(p.isDodging, true);
    assert.equal(p.y, GROUND_LEVEL);
  });
});

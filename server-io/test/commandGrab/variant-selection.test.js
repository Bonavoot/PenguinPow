"use strict";

/**
 * Command grab — latch aim.
 *
 * M2 is always a grab. After connect:
 *   • DRIVE is the default (toward / nothing / timeout).
 *   • W selects THROW, Back selects PULL, held or tapped.
 *   • Stamps from before the lunge do not count. Taps during the lunge do.
 *   • The most recent qualifying press wins. Ties go to W.
 *   • A tap latches; there is no path back to DRIVE after W or Back.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CMD_GRAB_VARIANT,
  noteGrabVariantEdges,
  resolveLatchVariant,
  beginLatchAim,
  updateLatchVariant,
  lockGrabVariant,
  clearGrabVariant,
} = require("../../commandGrabInput");

function makePair(overrides = {}) {
  const player = {
    id: "p1",
    x: 500,
    keys: { w: false, a: false, d: false, s: false },
    grabWTapTime: 0,
    grabATapTime: 0,
    grabDTapTime: 0,
    grabVariantLocked: false,
    ...overrides,
  };
  const opponent = { id: "p2", x: 572 };
  return { player, opponent };
}

const LATCH = 2000;

test("command grab latch aim", async (t) => {
  await t.test("no direction → DRIVE", () => {
    const { player, opponent } = makePair();
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.DRIVE);
  });

  await t.test("forward held is ignored → still DRIVE", () => {
    const { player, opponent } = makePair();
    player.keys.d = true;
    noteGrabVariantEdges(player, LATCH, { dJustPressed: true });
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.DRIVE);
  });

  await t.test("W held during latch → THROW", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, LATCH + 16, {});
    assert.equal(
      resolveLatchVariant(player, opponent, LATCH),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("W tapped then released still → THROW", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, LATCH + 10, { wJustPressed: true });
    player.keys.w = false;
    assert.equal(
      resolveLatchVariant(player, opponent, LATCH),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("back held during latch → PULL", () => {
    const { player, opponent } = makePair();
    player.keys.a = true;
    noteGrabVariantEdges(player, LATCH + 16, {});
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.PULL);
  });

  await t.test("a stamp from before the latch does not select", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, LATCH - 50, { wJustPressed: true });
    assert.equal(
      resolveLatchVariant(player, opponent, LATCH),
      CMD_GRAB_VARIANT.DRIVE,
      "pre-press chords must not aim the grab"
    );
  });

  await t.test("away side follows live positions", () => {
    const { player, opponent } = makePair({ x: 700 });
    opponent.x = 628;
    player.keys.d = true;
    noteGrabVariantEdges(player, LATCH + 10, { dJustPressed: true });
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.PULL);

    const second = makePair({ x: 700 });
    second.opponent.x = 628;
    second.player.keys.a = true;
    noteGrabVariantEdges(second.player, LATCH + 10, { aJustPressed: true });
    assert.equal(
      resolveLatchVariant(second.player, second.opponent, LATCH),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("later press wins: W then back → PULL", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, LATCH + 10, { wJustPressed: true });
    player.keys.w = false;
    noteGrabVariantEdges(player, LATCH + 40, { aJustPressed: true });
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.PULL);
  });

  await t.test("later press wins: back then W → THROW", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, LATCH + 10, { aJustPressed: true });
    noteGrabVariantEdges(player, LATCH + 40, { wJustPressed: true });
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.THROW);
  });

  await t.test("W and back both held → THROW (W wins the tie)", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    player.keys.a = true;
    noteGrabVariantEdges(player, LATCH + 16, {});
    assert.equal(resolveLatchVariant(player, opponent, LATCH), CMD_GRAB_VARIANT.THROW);
  });

  await t.test("updateLatchVariant revises until locked", () => {
    const { player, opponent } = makePair();
    beginLatchAim(player);
    assert.equal(player.grabVariant, CMD_GRAB_VARIANT.DRIVE);

    noteGrabVariantEdges(player, LATCH + 20, { wJustPressed: true });
    updateLatchVariant(player, opponent, LATCH);
    assert.equal(player.grabVariant, CMD_GRAB_VARIANT.THROW);

    lockGrabVariant(player);
    noteGrabVariantEdges(player, LATCH + 80, { aJustPressed: true });
    updateLatchVariant(player, opponent, LATCH);
    assert.equal(
      player.grabVariant,
      CMD_GRAB_VARIANT.THROW,
      "a press after lock must not retarget"
    );
  });

  await t.test("beginLatchAim wipes pre-press stamps", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, LATCH - 10, { wJustPressed: true });
    beginLatchAim(player);
    assert.equal(player.grabWTapTime, 0);
    assert.equal(
      resolveLatchVariant(player, opponent, LATCH),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("a tap during the lunge survives connect", () => {
    const { player, opponent } = makePair();
    const lungeStart = LATCH - 80;
    noteGrabVariantEdges(player, lungeStart + 20, { wJustPressed: true });
    player.keys.w = false;
    beginLatchAim(player, lungeStart);
    assert.equal(player.grabWTapTime, lungeStart + 20);
    assert.equal(
      resolveLatchVariant(player, opponent, player.grabAimOpenAt),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("clearGrabVariant wipes selection and stamps", () => {
    const { player } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, LATCH, { wJustPressed: true });
    beginLatchAim(player);
    lockGrabVariant(player);
    clearGrabVariant(player);
    assert.equal(player.grabVariant, null);
    assert.equal(player.grabVariantLocked, false);
    assert.equal(player.grabWTapTime, 0);
  });
});

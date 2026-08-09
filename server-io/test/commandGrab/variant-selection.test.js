"use strict";

/**
 * Command grab — variant selection.
 *
 * The rules under test, all chosen for leniency over symmetry:
 *   • DRIVE is the default (press nothing).
 *   • W selects THROW and Back selects PULL, either HELD or TAPPED. Holding the
 *     direction and pressing the button is the fighting-game convention; anything
 *     stricter reads as the game eating your input.
 *   • The most recent qualifying press wins, so a change of mind works.
 *   • Ties go to W (the "both at once" case).
 *   • The selection stays revisable through startup and is inert once locked.
 *   • While ice sliding, THROW is unavailable (W belongs to slide-jump), and that
 *     restriction is latched so an in-startup revision can't reintroduce it.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CMD_GRAB_VARIANT,
  noteGrabVariantEdges,
  resolveGrabVariant,
  stampGrabVariant,
  updateGrabVariant,
  lockGrabVariant,
  clearGrabVariant,
} = require("../../commandGrabInput");
const { CMD_GRAB_VARIANT_PREBUFFER_MS } = require("../../constants");

// Grabber on the LEFT, so "away" is 'a' and "toward" is 'd'.
function makePair(overrides = {}) {
  const player = {
    id: "p1",
    x: 500,
    keys: { w: false, a: false, d: false, s: false },
    grabWTapTime: 0,
    grabATapTime: 0,
    grabDTapTime: 0,
    isGrabStartup: true,
    grabStartupStartTime: 1000,
    ...overrides,
  };
  const opponent = { id: "p2", x: 572 };
  return { player, opponent };
}

test("command grab variant selection", async (t) => {
  await t.test("no direction → DRIVE", () => {
    const { player, opponent } = makePair();
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("forward held is ignored → still DRIVE", () => {
    // Forward is the natural approach hold; treating it as input would misread
    // every walk-in grab.
    const { player, opponent } = makePair();
    player.keys.d = true;
    noteGrabVariantEdges(player, 1000, { dJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("W held → THROW", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, 1000, {});
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("W tapped then released still → THROW (tap latches)", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 990, { wJustPressed: true });
    player.keys.w = false;
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("back TAPPED → PULL", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 995, { aJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("back HELD (no rising edge) → PULL", () => {
    // The reported bug: holding back and pressing M2 gave a Drive, because only a
    // rising edge stamped. A held direction now refreshes every packet.
    const { player, opponent } = makePair();
    player.keys.a = true;
    noteGrabVariantEdges(player, 1000, {}); // no rising edge — held from earlier
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("back held since long before the grab still → PULL", () => {
    // Retreating for a full second, then grabbing. The stamp must not have gone
    // stale out of the pre-buffer window.
    const { player, opponent } = makePair();
    player.keys.a = true;
    for (let t = 0; t <= 1000; t += 16) noteGrabVariantEdges(player, t, {});
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("released back still counts inside the pre-buffer", () => {
    const { player, opponent } = makePair();
    player.keys.a = true;
    noteGrabVariantEdges(player, 900, { aJustPressed: true });
    player.keys.a = false;
    noteGrabVariantEdges(player, 1000, {}); // released — stamp stops refreshing
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("away side follows live positions (grabber on the right)", () => {
    const { player, opponent } = makePair({ x: 700 });
    opponent.x = 628; // grabber now right of victim → away is 'd'
    player.keys.d = true;
    noteGrabVariantEdges(player, 995, { dJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
    // 'a' is now TOWARD, so it must be ignored no matter how hard it's held.
    const second = makePair({ x: 700 });
    second.opponent.x = 628;
    second.player.keys.a = true;
    noteGrabVariantEdges(second.player, 995, { aJustPressed: true });
    assert.equal(
      resolveGrabVariant(second.player, second.opponent, 1000),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("pre-buffer boundary: inside selects, outside does not", () => {
    const startup = 1000;
    const inside = makePair();
    noteGrabVariantEdges(inside.player, startup - CMD_GRAB_VARIANT_PREBUFFER_MS, {
      wJustPressed: true,
    });
    assert.equal(
      resolveGrabVariant(inside.player, inside.opponent, startup),
      CMD_GRAB_VARIANT.THROW
    );

    const outside = makePair();
    noteGrabVariantEdges(
      outside.player,
      startup - CMD_GRAB_VARIANT_PREBUFFER_MS - 1,
      { wJustPressed: true }
    );
    assert.equal(
      resolveGrabVariant(outside.player, outside.opponent, startup),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("later press wins: W tap then back tap → PULL", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 990, { wJustPressed: true });
    player.keys.w = false;
    noteGrabVariantEdges(player, 1040, { aJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("later press wins: back tap then W tap → THROW", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 990, { aJustPressed: true });
    noteGrabVariantEdges(player, 1040, { wJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("W and back both held → THROW (W wins the tie)", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    player.keys.a = true;
    noteGrabVariantEdges(player, 1000, {});
    // Both refresh to the same stamp every packet, so this resolves by the tie rule.
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
    noteGrabVariantEdges(player, 1050, {});
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW,
      "the tie must be stable, not alternate between packets"
    );
  });

  await t.test("held back beats a released W tap", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 900, { wJustPressed: true });
    player.keys.w = false;
    player.keys.a = true;
    noteGrabVariantEdges(player, 1000, {});
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.PULL,
      "an ongoing hold is newer intent than a stale tap"
    );
  });

  await t.test("simultaneous W + back → THROW (ties go to W)", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 1000, { wJustPressed: true, aJustPressed: true });
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("updateGrabVariant revises during startup, inert once locked", () => {
    const { player, opponent } = makePair();
    stampGrabVariant(player, opponent, 1000);
    assert.equal(player.grabVariant, CMD_GRAB_VARIANT.DRIVE);

    noteGrabVariantEdges(player, 1060, { wJustPressed: true });
    updateGrabVariant(player, opponent);
    assert.equal(player.grabVariant, CMD_GRAB_VARIANT.THROW);

    lockGrabVariant(player);
    noteGrabVariantEdges(player, 1120, { aJustPressed: true });
    updateGrabVariant(player, opponent);
    assert.equal(
      player.grabVariant,
      CMD_GRAB_VARIANT.THROW,
      "a press after the grab goes active must not retarget it"
    );
  });

  await t.test("there is no path back to DRIVE once a direction is pressed", () => {
    const { player, opponent } = makePair();
    noteGrabVariantEdges(player, 990, { wJustPressed: true });
    player.keys.w = false;
    // Pressing forward is not a revert — forward is ignored entirely.
    noteGrabVariantEdges(player, 1040, { dJustPressed: true });
    player.keys.d = true;
    assert.equal(
      resolveGrabVariant(player, opponent, 1000),
      CMD_GRAB_VARIANT.THROW
    );
  });

  await t.test("ice slide forbids THROW: M2+W out of a slide is a DRIVE", () => {
    // Deterministic by construction — otherwise whether M2+W produced a Throw or
    // a slide-jump would depend on which packet W landed in.
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, 1000, { wJustPressed: true });
    assert.equal(
      stampGrabVariant(player, opponent, 1000, true),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("ice slide still allows PULL", () => {
    const { player, opponent } = makePair();
    player.keys.a = true;
    noteGrabVariantEdges(player, 995, { aJustPressed: true });
    assert.equal(
      stampGrabVariant(player, opponent, 1000, true),
      CMD_GRAB_VARIANT.PULL
    );
  });

  await t.test("ice slide with W held falls to DRIVE, not PULL", () => {
    // W is forbidden, and nothing else was pressed, so there is no Pull to fall to.
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, 1000, {});
    assert.equal(
      stampGrabVariant(player, opponent, 1000, true),
      CMD_GRAB_VARIANT.DRIVE
    );
  });

  await t.test("forbidThrow is latched across in-startup revision", () => {
    const { player, opponent } = makePair();
    stampGrabVariant(player, opponent, 1000, true);
    player.keys.w = true;
    noteGrabVariantEdges(player, 1060, { wJustPressed: true });
    updateGrabVariant(player, opponent);
    assert.equal(
      player.grabVariant,
      CMD_GRAB_VARIANT.DRIVE,
      "a slide-grab must not become a Throw via a later W press"
    );
  });

  await t.test("clearGrabVariant wipes selection and stamps", () => {
    const { player, opponent } = makePair();
    player.keys.w = true;
    noteGrabVariantEdges(player, 1000, { wJustPressed: true });
    stampGrabVariant(player, opponent, 1000);
    lockGrabVariant(player);
    clearGrabVariant(player);
    assert.equal(player.grabVariant, null);
    assert.equal(player.grabVariantLocked, false);
    assert.equal(player.grabVariantThrowForbidden, false);
    assert.equal(player.grabWTapTime, 0);
    assert.equal(player.grabATapTime, 0);
    assert.equal(player.grabDTapTime, 0);
  });
});

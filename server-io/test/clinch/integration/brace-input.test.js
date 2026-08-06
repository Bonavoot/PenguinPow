"use strict";

/**
 * Brace input ergonomics + lag compensation, driven through the real socket
 * input path (processInputPacket) and the real authoritative resolver.
 *
 * The rule under test: Perfect Brace is an ACTIVE response, so it needs a fresh
 * Plant edge after the tell. A defender who is already holding the directional
 * Plant must be able to produce that edge without letting go.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_BRACE_ACTIVE_MS,
  CLINCH_BRACE_SETTLE_MS,
} = require("../../../constants");

/** One full Brace attempt cycle: press → ACTIVE → SETTLE → ready again. */
const BRACE_CYCLE_MS = CLINCH_BRACE_ACTIVE_MS + CLINCH_BRACE_SETTLE_MS;
const { processInputPacket } = require("../../../socketHandlers");
const { gameNow, getPlayerInputBackdateCapMs } = require("../../../gameUtils");
const {
  createClinchScenario,
  makeInputPacket,
  blankKeys,
  awayKey,
  towardKey,
  withRoleSwap,
} = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

/**
 * Deliver a key snapshot for `player`. `events` use the wire shape the socket
 * layer reads for trusted press reconstruction: { k, a: "down"|"up", t }.
 */
function applyPacket(s, player, keys, { events = [], clientOffset = 0, receiptGameNow } = {}) {
  const receipt = receiptGameNow != null ? receiptGameNow : gameNow();
  processInputPacket(
    s.room,
    player,
    makeInputPacket({
      id: player.id,
      keys: { ...blankKeys(), ...keys },
      events,
      clientSynced: true,
      clientOffset,
      clientRtt: 60,
      receiptGameNow: receipt,
    }),
    s.io,
    s.rooms
  );
}

describe("Brace input ergonomics", () => {
  it("holding directional Plant is passive — no fresh edge, no Perfect Brace", () => {
    withRoleSwap({}, (s, label) => {
      const away = awayKey(s.grabbed, s.grabber);
      // Establish Plant BEFORE the tell.
      applyPacket(s, s.grabbed, { [away]: true });
      const establishedAt = s.grabbed.clinchBraceSimTime;
      assert.ok(establishedAt > 0, `${label}: away edge stamps activation`);

      s.advance(32);
      assert.ok(establishedAt < s.now(), `${label}: Plant predates the tell`);
      s.setActiveTechnique(s.grabber, "throw", s.now());
      // Keep holding — repeated snapshots produce no new rising edge.
      s.advance(60);
      applyPacket(s, s.grabbed, { [away]: true });
      assert.equal(s.grabbed.clinchBraceSimTime, establishedAt, label);

      s.advance(CLINCH_THROW_ANIMATION_MS);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      const fail = s.io.last("clinch_throw_fail");
      assert.ok(fail, label);
      assert.equal(fail.payload.resistedByPlant, true, label);
      assert.equal(!!fail.payload.perfectBrace, false, label);
      assert.equal(s.grabbed.hasDeepGrip, false, label);
    });
  });

  for (const type of ["throw", "pull"]) {
    const anim = type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;

    it(`${type}: S while STILL HOLDING away arms Perfect Brace (no release needed)`, () => {
      withRoleSwap({}, (s, label) => {
        const away = awayKey(s.grabbed, s.grabber);
        applyPacket(s, s.grabbed, { [away]: true });
        const passiveStamp = s.grabbed.clinchBraceSimTime;

        // Sit in the stance long enough for that first attempt's cycle to finish,
        // which is what "already holding Plant" actually looks like in play.
        s.advance(BRACE_CYCLE_MS);
        s.setActiveTechnique(s.grabber, type, s.now());
        s.advance(48);

        // Away stays held; S is the fresh Brace action.
        applyPacket(s, s.grabbed, { [away]: true, s: true });
        assert.equal(s.grabbed.sJustPressed, true, label);
        assert.equal(s.grabbed.keys[away], true, `${label}: away never released`);
        assert.ok(
          s.grabbed.clinchBraceSimTime > passiveStamp,
          `${label}: S re-stamps activation`
        );

        s.advance(anim);
        if (s.grabber.clinchThrowActive) s.stepOnce();
        const fail = s.io.last("clinch_throw_fail");
        assert.ok(fail, label);
        assert.equal(fail.payload.perfectBrace, true, label);
        assert.equal(s.grabbed.hasDeepGrip, true, label);
      });
    });

    it(`${type}: re-flicking the away direction also arms Perfect Brace`, () => {
      const s = sc();
      const away = awayKey(s.grabbed, s.grabber);
      applyPacket(s, s.grabbed, { [away]: true });
      const passiveStamp = s.grabbed.clinchBraceSimTime;

      s.advance(BRACE_CYCLE_MS);
      s.setActiveTechnique(s.grabber, type, s.now());
      s.advance(32);
      // Release + re-press within the startup (stick re-flick / key retap).
      applyPacket(s, s.grabbed, {});
      s.advance(16);
      applyPacket(s, s.grabbed, { [away]: true });
      assert.ok(s.grabbed.clinchBraceSimTime > passiveStamp);

      s.advance(anim);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      assert.equal(s.io.last("clinch_throw_fail").payload.perfectBrace, true);
    });
  }

  it("S alone (no direction) is a valid Plant/Brace action", () => {
    const s = sc();
    s.setActiveTechnique(s.grabber, "throw", s.now());
    s.advance(32);
    applyPacket(s, s.grabbed, { s: true });
    assert.ok(s.grabbed.clinchBraceSimTime >= s.grabber.clinchThrowStartTime);
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.equal(s.io.last("clinch_throw_fail").payload.perfectBrace, true);
  });

  it("holding toward suppresses the Brace edge (aggression is not a brace)", () => {
    const s = sc();
    const toward = towardKey(s.grabbed, s.grabber);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    s.advance(32);
    applyPacket(s, s.grabbed, { [toward]: true, s: true });
    assert.equal(s.grabbed.clinchBraceSimTime, 0, "toward held → no brace stamp");
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.ok(!s.io.last("clinch_throw_fail"), "technique lands through a Drive");
  });

  it("no Brace edge is stamped while the defender is Open", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    s.setOpen(s.grabbed, s.now() + 500);
    applyPacket(s, s.grabbed, { [away]: true, s: true });
    assert.equal(s.grabbed.clinchBraceSimTime, 0);
  });
});

describe("Brace lag compensation uses the full startup window", () => {
  it("a backdated press still lands inside the window (no packet-arrival penalty)", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    // Player truly reacted 90ms into the startup; the packet arrives 90ms later.
    s.advance(180);
    const receipt = gameNow();
    const pressGameTime = receipt - 90;
    applyPacket(s, s.grabbed, { [away]: true }, {
      events: [{ k: away, a: "down", t: pressGameTime }],
      receiptGameNow: receipt,
    });
    const stamp = s.grabbed.clinchBraceSimTime;
    assert.ok(stamp < s.now(), "press was backdated toward the true moment");
    assert.ok(stamp >= start, "backdate never falls behind the visible tell");
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.equal(s.io.last("clinch_throw_fail").payload.perfectBrace, true);
  });

  it("backdate stays bounded, so a spoofed ancient press cannot rewrite history", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    s.advance(64);
    const receipt = gameNow();
    const cap = getPlayerInputBackdateCapMs(s.grabbed);
    applyPacket(s, s.grabbed, { [away]: true }, {
      events: [{ k: away, a: "down", t: receipt - 60_000 }],
      receiptGameNow: receipt,
    });
    assert.ok(
      s.grabbed.clinchBraceSimTime >= s.now() - cap,
      "clamped to the trusted backdate envelope"
    );
  });

  it("a press that truly happened before the tell stays predictive under lag", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    // Press first, technique becomes visible afterwards.
    const receipt = gameNow();
    applyPacket(s, s.grabbed, { [away]: true }, {
      events: [{ k: away, a: "down", t: receipt - 40 }],
      receiptGameNow: receipt,
    });
    const stamp = s.grabbed.clinchBraceSimTime;
    s.advance(32);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    assert.ok(stamp < s.grabber.clinchThrowStartTime);
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(!!fail.payload.perfectBrace, false, "prediction, not a response");
    assert.equal(fail.payload.resistedByPlant, true);
  });
});

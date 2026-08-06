"use strict";

/**
 * BRACE ATTEMPT CYCLE — one press is one attempt.
 *
 * Driven through the real socket input path so the thing under test is the same
 * edge detection a player's packets go through, not a helper.
 *
 * The skill distinction being enforced:
 *   • Wait, see the tell, press once            → reliable Perfect Brace, refunded
 *   • Hold Plant                                → resists a raw technique, loses to Deep Grip
 *   • Fish with repeated Back/S                 → spends most of its time unable to brace, and pays stamina
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_BRACE_ACTIVE_MS,
  CLINCH_BRACE_SETTLE_MS,
  CLINCH_BRACE_ATTEMPT_STAMINA_COST,
  CLINCH_BRACE_IMPACT_SLACK_MS,
} = require("../../../constants");
const { processInputPacket } = require("../../../socketHandlers");
const { braceCyclePhase, isBraceReady } = require("../../../grabActionSystem");
const { gameNow } = require("../../../gameUtils");
const {
  createClinchScenario,
  makeInputPacket,
  blankKeys,
  awayKey,
  towardKey,
} = require("../harness");

const BRACE_CYCLE_MS = CLINCH_BRACE_ACTIVE_MS + CLINCH_BRACE_SETTLE_MS;

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

function applyPacket(s, player, keys) {
  processInputPacket(
    s.room,
    player,
    makeInputPacket({
      id: player.id,
      keys: { ...blankKeys(), ...keys },
      clientSynced: true,
      clientOffset: 0,
      clientRtt: 60,
      receiptGameNow: gameNow(),
    }),
    s.io,
    s.rooms
  );
}

/** Release everything, then press the given brace key — a genuine fresh edge. */
function braceEdge(s, player, key) {
  applyPacket(s, player, {});
  applyPacket(s, player, { [key]: true });
}

function animFor(type) {
  return type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
}

function resolveTechnique(s, type) {
  s.advance(animFor(type));
  if (s.grabber.clinchThrowActive) s.stepOnce();
  return s.io.last("clinch_throw_fail");
}

describe("Brace cycle timing", () => {
  it(`ACTIVE (${CLINCH_BRACE_ACTIVE_MS}ms) exceeds the longest startup + slack`, () => {
    // This is what guarantees no in-startup press is ever wasted: a press on the
    // very first frame of a Pull is still active when it lands.
    assert.ok(
      CLINCH_BRACE_ACTIVE_MS >= CLINCH_PULL_ANIMATION_MS + CLINCH_BRACE_IMPACT_SLACK_MS,
      `${CLINCH_BRACE_ACTIVE_MS} must cover ${CLINCH_PULL_ANIMATION_MS} + ${CLINCH_BRACE_IMPACT_SLACK_MS}`
    );
  });

  it("phases advance press → active → settle → ready", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    assert.equal(braceCyclePhase(s.grabbed, s.now()), "active");

    s.advance(CLINCH_BRACE_ACTIVE_MS - 32);
    assert.equal(braceCyclePhase(s.grabbed, s.now()), "active");

    s.advance(64);
    assert.equal(braceCyclePhase(s.grabbed, s.now()), "settle");
    assert.equal(isBraceReady(s.grabbed, s.now()), false);

    s.advance(CLINCH_BRACE_SETTLE_MS);
    assert.equal(braceCyclePhase(s.grabbed, s.now()), "ready");
    assert.equal(isBraceReady(s.grabbed, s.now()), true);
  });

  it("the presentation phase mirrors the authoritative cycle", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    s.stepOnce();
    assert.equal(s.grabbed.clinchBracePhase, "active", "visible brace-set pose");
    s.advance(CLINCH_BRACE_ACTIVE_MS + 16);
    assert.equal(s.grabbed.clinchBracePhase, "settle", "visible settle pose");
    s.advance(CLINCH_BRACE_SETTLE_MS + 16);
    assert.equal(s.grabbed.clinchBracePhase, null, "back to neutral stance");
  });
});

describe("A ready single reaction always Perfect Braces", () => {
  for (const type of ["throw", "pull"]) {
    const anim = animFor(type);
    for (const [where, offset] of [
      ["beginning", 0],
      ["middle", Math.round(anim / 2)],
      ["just before impact", anim - 16],
    ]) {
      it(`${type}: one press at the ${where} of startup Perfect Braces`, () => {
        const s = sc();
        const away = awayKey(s.grabbed, s.grabber);
        s.setActiveTechnique(s.grabber, type, s.now());
        if (offset > 0) s.advance(offset);
        braceEdge(s, s.grabbed, away);

        const fail = resolveTechnique(s, type);
        assert.ok(fail, "technique was answered");
        assert.equal(fail.payload.perfectBrace, true);
        assert.equal(s.grabbed.hasDeepGrip, true, "the read is rewarded");
      });

      it(`${type}: the same press beats a DEEP GRIP technique at the ${where}`, () => {
        const s = sc();
        const away = awayKey(s.grabbed, s.grabber);
        s.setDeepGrip(s.grabber);
        s.setActiveTechnique(s.grabber, type, s.now());
        if (offset > 0) s.advance(offset);
        braceEdge(s, s.grabbed, away);

        const fail = resolveTechnique(s, type);
        assert.ok(fail, "Deep Grip does not bypass an active read");
        assert.equal(fail.payload.perfectBrace, true);
        assert.equal(s.grabbed.hasDeepGrip, true, "grip changes hands");
      });
    }
  }

  it("a correct read is free — the attempt cost is refunded", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    const before = s.grabbed.stamina;
    s.setActiveTechnique(s.grabber, "throw", s.now());
    braceEdge(s, s.grabbed, away);
    assert.equal(
      s.grabbed.stamina,
      before - CLINCH_BRACE_ATTEMPT_STAMINA_COST,
      "the attempt is charged up front"
    );
    resolveTechnique(s, "throw");
    assert.equal(
      s.grabbed.stamina,
      before,
      "and refunded in full when the read lands"
    );
  });

  it("a fished attempt is NOT refunded — this is the real anti-spam", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    const before = s.grabbed.stamina;
    braceEdge(s, s.grabbed, away); // nothing incoming
    s.advance(BRACE_CYCLE_MS + 16);
    assert.equal(
      s.grabbed.stamina,
      before - CLINCH_BRACE_ATTEMPT_STAMINA_COST,
      "fishing costs the tank that powers your own shove"
    );
  });
});

describe("Spam cannot bypass the cycle", () => {
  it("alternating Back and S shares one cycle", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    const firstAttempt = s.grabbed.clinchBraceAttemptStart;
    assert.ok(firstAttempt > 0);
    const stampAfterFirst = s.grabbed.clinchBraceSimTime;

    // Switch inputs mid-cycle: S is a different key, same Brace.
    s.advance(48);
    braceEdge(s, s.grabbed, "s");
    assert.equal(
      s.grabbed.clinchBraceAttemptStart,
      firstAttempt,
      "the cycle is neither restarted nor extended"
    );
    assert.equal(
      s.grabbed.clinchBraceSimTime,
      stampAfterFirst,
      "and no new activation stamp is produced"
    );
  });

  // The exploitable band: the whole technique window has to fit inside the
  // spent cycle. If a future tuning pass shrinks this below a human-usable
  // margin, mashing becomes near-guaranteed defense again — so assert it.
  for (const [type, anim] of [
    ["throw", CLINCH_THROW_ANIMATION_MS],
    ["pull", CLINCH_PULL_ANIMATION_MS],
  ]) {
    it(`${type}: the spent cycle leaves a usable window to launch into`, () => {
      const band =
        BRACE_CYCLE_MS - (anim + CLINCH_BRACE_IMPACT_SLACK_MS);
      assert.ok(
        band >= 200,
        `only ${band}ms of the ${BRACE_CYCLE_MS}ms cycle can deny a ${type}; ` +
          `a fisher would be effectively safe`
      );
    });

    it(`${type}: mashing cannot save a technique launched into the spent cycle`, () => {
      const s = sc();
      const away = awayKey(s.grabbed, s.grabber);
      // A wasted predictive attempt spends the cycle...
      braceEdge(s, s.grabbed, away);
      // ...and the attacker launches inside it, early enough that impact also
      // lands inside it.
      s.advance(96);
      s.setActiveTechnique(s.grabber, type, s.now());
      // Mash both brace keys for the entire startup.
      for (let t = 0; t < anim; t += 32) {
        braceEdge(s, s.grabbed, (t / 32) % 2 === 0 ? away : "s");
        s.advance(32);
      }
      if (s.grabber.clinchThrowActive) s.stepOnce();
      const fail = s.io.last("clinch_throw_fail");
      assert.ok(fail, "held Plant still passively resisted the raw technique");
      assert.equal(
        !!fail.payload.perfectBrace,
        false,
        "mashing must not produce an active read"
      );
      assert.equal(s.grabbed.hasDeepGrip, false, "and earns no Deep Grip");
    });
  }

  it("repeated inputs are not queued to fire when rearm ends", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    const firstAttempt = s.grabbed.clinchBraceAttemptStart;
    // Mash for the entire cycle, then stop pressing.
    for (let t = 0; t < BRACE_CYCLE_MS; t += 32) {
      braceEdge(s, s.grabbed, away);
      s.advance(32);
    }
    applyPacket(s, s.grabbed, {});
    s.advance(32);
    assert.equal(
      s.grabbed.clinchBraceAttemptStart,
      firstAttempt,
      "nothing queued: the cycle still belongs to the original press"
    );
    assert.equal(isBraceReady(s.grabbed, s.now()), true, "and it is now ready");
  });

  it("a genuinely new edge after rearm Perfect Braces normally", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    s.advance(BRACE_CYCLE_MS + 16);
    assert.equal(isBraceReady(s.grabbed, s.now()), true);

    s.setActiveTechnique(s.grabber, "throw", s.now());
    s.advance(60);
    braceEdge(s, s.grabbed, away);
    const fail = resolveTechnique(s, "throw");
    assert.equal(fail.payload.perfectBrace, true, "the cycle recharged");
    assert.equal(s.grabbed.hasDeepGrip, true);
  });
});

describe("Passive Plant during rearm", () => {
  it("still resists a NORMAL technique", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    s.advance(CLINCH_BRACE_ACTIVE_MS + 32); // settling, away still held
    s.setActiveTechnique(s.grabber, "throw", s.now());
    const fail = resolveTechnique(s, "throw");
    assert.ok(fail);
    assert.equal(fail.payload.resistedByPlant, true, "the stance still holds");
    assert.equal(!!fail.payload.perfectBrace, false);
  });

  it("but DEEP GRIP defeats it — the point of Deep Grip", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    s.setDeepGrip(s.grabber);
    braceEdge(s, s.grabbed, away);
    s.advance(CLINCH_BRACE_ACTIVE_MS + 32);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.ok(
      !s.io.last("clinch_throw_fail"),
      "no resist — Deep Grip broke the passive Plant"
    );
    assert.equal(s.grabbed.isBeingThrown, true, "the technique landed");
  });
});

describe("Brace state hygiene", () => {
  it("an armed Brace survives key release until impact", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    braceEdge(s, s.grabbed, away);
    s.advance(48);
    applyPacket(s, s.grabbed, {}); // let go — tap instinct
    const fail = resolveTechnique(s, "throw");
    assert.equal(fail.payload.perfectBrace, true, "the read still counts");
  });

  it("committing toward the opponent cancels the armed Brace", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    const toward = towardKey(s.grabbed, s.grabber);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    braceEdge(s, s.grabbed, away);
    s.advance(48);
    applyPacket(s, s.grabbed, { [toward]: true }); // change my mind → Drive
    const fail = resolveTechnique(s, "throw");
    assert.equal(
      !!(fail && fail.payload.perfectBrace),
      false,
      "an abandoned brace is not a brace"
    );
  });

  it("Open clears the attempt cycle outright", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    assert.ok(s.grabbed.clinchBraceAttemptStart > 0);
    s.setOpen(s.grabbed, s.now() + 400);
    s.stepOnce();
    assert.equal(s.grabbed.clinchBraceAttemptStart, 0);
    assert.equal(s.grabbed.clinchBracePhase, null);
  });

  it("no Brace state leaks into the next technique", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    braceEdge(s, s.grabbed, away);
    resolveTechnique(s, "throw");
    assert.equal(
      s.grabbed.clinchBraceArmedTechnique,
      null,
      "the arm belonged to a technique that is over"
    );
    assert.equal(
      s.grabbed.clinchBraceAttemptStart,
      0,
      "and a landed read leaves the cycle ready, not half-spent"
    );
  });

  it("no Brace state leaks into the next clinch", () => {
    const s = sc();
    const away = awayKey(s.grabbed, s.grabber);
    braceEdge(s, s.grabbed, away);
    assert.ok(s.grabbed.clinchBraceAttemptStart > 0);
    const { cleanupGrabStates } = require("../../../gameFunctions");
    cleanupGrabStates(s.grabber, s.grabbed);
    assert.equal(s.grabbed.clinchBraceAttemptStart, 0);
    assert.equal(s.grabbed.clinchBracePhase, null);
    assert.equal(s.grabbed.clinchBraceAttemptRefunded, false);
  });
});

describe("The CPU obeys the same cycle", () => {
  it("CPU brace stamps cannot appear while its cycle is spent", () => {
    const s = sc();
    const cpu = s.grabbed;
    cpu.isCPU = true;
    // Spend the cycle.
    const away = awayKey(cpu, s.grabber);
    braceEdge(s, cpu, away);
    const spentAt = cpu.clinchBraceAttemptStart;
    assert.ok(spentAt > 0);

    // The CPU path stamps through beginBraceAttempt, so a mid-cycle attempt is
    // refused exactly as a player's would be.
    const { beginBraceAttempt } = require("../../../grabActionSystem");
    s.advance(48);
    assert.equal(
      beginBraceAttempt(cpu, s.now()),
      false,
      "CPU cannot bypass rearm"
    );
    assert.equal(cpu.clinchBraceAttemptStart, spentAt, "cycle untouched");

    s.advance(BRACE_CYCLE_MS);
    assert.equal(
      beginBraceAttempt(cpu, s.now()),
      true,
      "and it recharges on the same schedule"
    );
  });
});

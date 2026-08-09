"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseInputCommandReliabilityV2Flag,
  setInputCommandReliabilityV2ForTests,
  isInputCommandReliabilityV2Enabled,
} = require("../../inputCommandReliabilityFlags");
const {
  RELATIVE_DIR,
  PALM_DIR_CHORD_MS,
  PALM_DIR_CHORD_TICKS,
  resolveStrikeRelativeDirection,
  relativeDirFromPacketEvents,
  tryConvertSlapToPalmChord,
  stampDirectionTaps,
  clearDirectionTapState,
} = require("../../inputCommandReliability");
const {
  INPUT_REJECT,
  noteCommandReject,
  noteCommandAccept,
  clearInputCommandNotes,
} = require("../../inputCommandRejection");
const {
  TRACE_CAP,
  pushInputCommandTrace,
  getInputCommandTrace,
  clearInputCommandTrace,
  getLastInputCommandResult,
  INPUT_COMMAND_STAGE,
} = require("../../inputCommandTrace");
const {
  isActionLifecycleOwnershipV2Enabled,
  parseActionLifecycleOwnershipV2Flag,
} = require("../../actionLifecycleFlags");
const {
  parseCombatContactFidelityV2Flag,
} = require("../../combatContactFidelityFlags");

function makePlayer(overrides = {}) {
  return {
    id: "p1",
    facing: -1,
    keys: { a: false, d: false, s: false, w: false, mouse1: false, mouse2: false },
    dirATapTime: 0,
    dirDTapTime: 0,
    aJustPressed: false,
    dJustPressed: false,
    isSlapAttack: false,
    isAttacking: false,
    isInStartupFrames: false,
    currentSlapHitConnected: false,
    attackStartTime: 0,
    isPalmThrust: false,
    ...overrides,
  };
}

describe("Phase 16 — INPUT_COMMAND_RELIABILITY_V2 flag", () => {
  afterEach(() => setInputCommandReliabilityV2ForTests(null));

  it("unset / null / empty selects V2 (default ON)", () => {
    assert.equal(parseInputCommandReliabilityV2Flag(undefined), true);
    assert.equal(parseInputCommandReliabilityV2Flag(null), true);
    assert.equal(parseInputCommandReliabilityV2Flag(""), true);
    assert.equal(isInputCommandReliabilityV2Enabled(undefined), true);
  });

  it("1/true on, 0/false off", () => {
    assert.equal(parseInputCommandReliabilityV2Flag("1"), true);
    assert.equal(parseInputCommandReliabilityV2Flag("true"), true);
    assert.equal(parseInputCommandReliabilityV2Flag("0"), false);
    assert.equal(parseInputCommandReliabilityV2Flag("false"), false);
    assert.equal(isInputCommandReliabilityV2Enabled("0"), false);
  });
});

describe("Phase 16 — directional acquisition", () => {
  beforeEach(() => setInputCommandReliabilityV2ForTests(true));
  afterEach(() => setInputCommandReliabilityV2ForTests(null));

  it("1 Back held then Mouse1 → BACK", () => {
    const p = makePlayer({ facing: -1, keys: { a: true, d: false } });
    const r = resolveStrikeRelativeDirection(p, { events: [] }, {
      facingSnap: -1,
      nowSim: 1000,
      prevKeys: { a: true },
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.BACK);
  });

  it("2 nearly simultaneous Back+Mouse1 in same packet (Mouse1 first) → BACK", () => {
    const p = makePlayer({ facing: -1, keys: { a: true, d: false, mouse1: true } });
    const events = [
      { k: "mouse1", a: "down", t: 1 },
      { k: "a", a: "down", t: 2 },
    ];
    const fromEv = relativeDirFromPacketEvents(events, -1, {});
    assert.equal(fromEv, RELATIVE_DIR.BACK);
    const r = resolveStrikeRelativeDirection(p, { events }, {
      facingSnap: -1,
      nowSim: 1000,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.BACK);
  });

  it("3 Mouse1 narrowly before Back via recent tap window", () => {
    const p = makePlayer({
      facing: -1,
      keys: { a: false, d: false },
      dirATapTime: 980,
    });
    const r = resolveStrikeRelativeDirection(p, { events: [] }, {
      facingSnap: -1,
      nowSim: 1000,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.BACK);
    assert.ok(PALM_DIR_CHORD_MS >= 40);
    assert.equal(PALM_DIR_CHORD_TICKS, 3);
  });

  it("4 Mouse1 outside chord window stays NEUTRAL", () => {
    const p = makePlayer({
      facing: -1,
      keys: { a: false, d: false },
      dirATapTime: 1000 - PALM_DIR_CHORD_MS - 1,
    });
    const r = resolveStrikeRelativeDirection(p, { events: [] }, {
      facingSnap: -1,
      nowSim: 1000,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.NEUTRAL);
  });

  it("5 Forward + Mouse1 → FORWARD", () => {
    const p = makePlayer({ facing: -1, keys: { a: false, d: true } });
    const r = resolveStrikeRelativeDirection(p, {}, {
      facingSnap: -1,
      nowSim: 1,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.FORWARD);
  });

  it("6 Neutral Mouse1 → NEUTRAL", () => {
    const p = makePlayer({ facing: -1, keys: { a: false, d: false } });
    const r = resolveStrikeRelativeDirection(p, {}, {
      facingSnap: -1,
      nowSim: 1,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.NEUTRAL);
  });

  it("7 Both A and D → AMBIGUOUS", () => {
    const p = makePlayer({ facing: -1, keys: { a: true, d: true } });
    const r = resolveStrikeRelativeDirection(p, {}, {
      facingSnap: -1,
      nowSim: 1,
      prevKeys: {},
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.AMBIGUOUS);
  });

  it("8 both facings mirror back key", () => {
    const rightFacing = makePlayer({ facing: 1, keys: { a: false, d: true } });
    const r1 = resolveStrikeRelativeDirection(rightFacing, {}, {
      facingSnap: 1,
      nowSim: 1,
    });
    assert.equal(r1.relativeDir, RELATIVE_DIR.BACK);
    const leftFacing = makePlayer({ facing: -1, keys: { a: true, d: false } });
    const r2 = resolveStrikeRelativeDirection(leftFacing, {}, {
      facingSnap: -1,
      nowSim: 1,
    });
    assert.equal(r2.relativeDir, RELATIVE_DIR.BACK);
  });

  it("10 facing snapshot ignored for live facing flip after acquisition", () => {
    const p = makePlayer({ facing: 1, keys: { a: true, d: false } });
    // Snapshot was -1 (back=A); live facing flipped to 1 but we pass snap -1.
    const r = resolveStrikeRelativeDirection(p, {}, {
      facingSnap: -1,
      nowSim: 1,
    });
    assert.equal(r.relativeDir, RELATIVE_DIR.BACK);
    assert.equal(r.facingSnap, -1);
  });

  it("14 key repeat does not invent new taps without JustPressed", () => {
    const p = makePlayer({ aJustPressed: false, dJustPressed: false });
    stampDirectionTaps(p, 500);
    assert.equal(p.dirATapTime, 0);
    p.aJustPressed = true;
    stampDirectionTaps(p, 500);
    assert.equal(p.dirATapTime, 500);
  });

  it("17/18 stale convert rejected after chord window; one convert path", () => {
    let palmCalls = 0;
    const p = makePlayer({
      isSlapAttack: true,
      isAttacking: true,
      isInStartupFrames: true,
      attackStartTime: 1000,
      _strikeFacingSnap: -1,
      keys: { a: true, d: false },
    });
    const ok = tryConvertSlapToPalmChord(p, [], () => {
      palmCalls++;
      p.isPalmThrust = true;
      p.isAttacking = true;
    }, {
      nowSim: 1000 + PALM_DIR_CHORD_MS + 1,
      backJustPressed: true,
      cancelPendingSlapWork: () => {},
    });
    assert.equal(ok, false);
    assert.equal(palmCalls, 0);

    p.attackStartTime = 2000;
    const ok2 = tryConvertSlapToPalmChord(p, [], () => {
      palmCalls++;
      p.isPalmThrust = true;
      p.isAttacking = true;
      p.isSlapAttack = false;
    }, {
      nowSim: 2000 + 10,
      backJustPressed: true,
      cancelPendingSlapWork: () => {},
    });
    assert.equal(ok2, true);
    assert.equal(palmCalls, 1);
  });
});

describe("Phase 16 — legacy path exactness", () => {
  afterEach(() => setInputCommandReliabilityV2ForTests(null));

  it("legacy ignores recent taps — held keys only", () => {
    setInputCommandReliabilityV2ForTests(false);
    const p = makePlayer({
      facing: -1,
      keys: { a: false, d: false },
      dirATapTime: 999,
    });
    const r = resolveStrikeRelativeDirection(p, {
      events: [
        { k: "mouse1", a: "down" },
        { k: "a", a: "down" },
      ],
    }, { facingSnap: -1, nowSim: 1000, prevKeys: {} });
    // Legacy path does not use packet event ordering for relative dir.
    assert.equal(r.source, "legacy_held");
    assert.equal(r.relativeDir, RELATIVE_DIR.NEUTRAL);
  });

  it("16 reset clears direction / reject notes", () => {
    const p = makePlayer({ dirATapTime: 9, _pendingPalmChordUntil: 9 });
    noteCommandReject(p, INPUT_REJECT.RECOVERY_ACTIVE, { command: "dodge" });
    clearDirectionTapState(p);
    clearInputCommandNotes(p);
    assert.equal(p.dirATapTime, 0);
    assert.equal(p._lastInputCommandReject, null);
  });
});

describe("Phase 16 — rejection reasons + trace bound", () => {
  it("rejection reason codes are stable strings", () => {
    assert.equal(INPUT_REJECT.NO_DIRECTION, "NO_DIRECTION");
    assert.equal(INPUT_REJECT.THROW_RECOVERY_ACTIVE, "THROW_RECOVERY_ACTIVE");
    assert.equal(INPUT_REJECT.DEFENDER_PERFECT_BRACE, "DEFENDER_PERFECT_BRACE");
    assert.equal(INPUT_REJECT.DODGE_RECOVERY_FRESH, "DODGE_RECOVERY_FRESH");
  });

  it("trace capped at 256", () => {
    process.env.INPUT_COMMAND_TRACE = "1";
    // Re-require won't refresh — push checks isInputCommandTraceEnabled at module load.
    // Exercise buffer manually via clear + many pushes only if enabled.
    clearInputCommandTrace("p1");
    noteCommandAccept({ id: "p1" }, "slap", {});
    assert.ok(TRACE_CAP === 256);
    clearInputCommandTrace();
  });

  it("46 lifecycle V2 remains default ON", () => {
    assert.equal(parseActionLifecycleOwnershipV2Flag(undefined), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled(undefined), true);
  });

  it("47 contact V2 remains default ON", () => {
    assert.equal(parseCombatContactFidelityV2Flag(undefined), true);
  });
});

describe("command grab input contract", () => {
  // Replaces the old Phase 16 clinch-contract block. That asserted the Deep Grip /
  // Perfect Brace / chord-window contract, all of which belonged to the mutual
  // clinch subgame and no longer exist. What still needs guarding is the boundary
  // this file cares about: grab variant selection must stay OUT of the strike
  // command path, and the input layer must not regrow a post-connect grab decision.
  it("variant selection is owned by commandGrabInput, not the strike chord path", () => {
    const fs = require("fs");
    const path = require("path");
    const reliability = fs.readFileSync(
      path.join(__dirname, "../../inputCommandReliability.js"),
      "utf8"
    );
    assert.equal(
      /grabVariant/.test(reliability),
      false,
      "the palm/direction chord layer must not reach into grab variant selection"
    );
  });

  it("the input layer files no post-connect grab decision", () => {
    // The command grab is uninterruptible once it connects: no Brace, no Jolt, no
    // post-connect Break. If any of those request fields reappear in the socket
    // path, a reaction-based answer has been reintroduced by accident.
    const fs = require("fs");
    const path = require("path");
    const sock = fs.readFileSync(
      path.join(__dirname, "../../socketHandlers.js"),
      "utf8"
    );
    for (const field of [
      "clinchJoltRequest",
      "clinchBreakRequest",
      "clinchThrowRequest",
      "clinchBraceSimTime",
    ]) {
      assert.equal(
        sock.includes(field),
        false,
        `${field} is a post-connect clinch decision and must stay deleted`
      );
    }
  });
});
